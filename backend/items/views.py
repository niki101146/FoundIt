import math
import re
from django.contrib.auth import authenticate
from django.db.models import Q, F
from django.utils.dateparse import parse_date
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, action, permission_classes, throttle_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from .models import Item, Claim
from .serializers import ItemSerializer, ClaimSerializer, RegisterSerializer

class AuthRateThrottle(AnonRateThrottle):
    scope = "auth"

SORTS = {"newest": "-created_at", "oldest": "created_at", "date": "-date"}

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.owner == request.user

def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))

def words(text):
    return {w for w in re.findall(r"[a-z0-9]{3,}", text.lower())}

class ItemViewSet(viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = Item.objects.select_related("owner")
        p = self.request.query_params
        for f in ("type", "category", "status"):
            if p.get(f): qs = qs.filter(**{f: p[f]})
        if p.get("color"): qs = qs.filter(color__icontains=p["color"])
        if p.get("date_from"):
            try:
                d = parse_date(p["date_from"])
            except ValueError:
                d = None
            if d:
                qs = qs.filter(date__gte=d)
        if p.get("has_reward") == "1": qs = qs.exclude(reward="")
        if p.get("q"):
            qs = qs.filter(Q(title__icontains=p["q"]) | Q(description__icontains=p["q"]) |
                           Q(location__icontains=p["q"]) | Q(brand__icontains=p["q"]))
        if p.get("lat") and p.get("lng"):
            try:
                lat, lng, rad = float(p["lat"]), float(p["lng"]), float(p.get("radius") or 5)
                ids = [i.id for i in qs.exclude(latitude=None).exclude(longitude=None)
                       if haversine(lat, lng, i.latitude, i.longitude) <= rad]
                qs = qs.filter(id__in=ids)
            except ValueError:
                pass
        return qs.order_by(SORTS.get(p.get("sort"), "-created_at"))

    def retrieve(self, request, *args, **kwargs):
        Item.objects.filter(pk=kwargs["pk"]).update(views=F("views") + 1)
        return super().retrieve(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        item = self.get_object()
        if item.owner != request.user:
            return Response({"detail": "Only the owner can do this."}, status=403)
        item.status = "resolved"
        item.save()
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=["get", "post"], permission_classes=[permissions.IsAuthenticated])
    def claims(self, request, pk=None):
        item = self.get_object()
        if request.method == "POST":
            if not request.user.is_authenticated:
                return Response({"detail": "Log in first."}, status=401)
            if item.owner == request.user:
                return Response({"detail": "You cannot claim your own post."}, status=400)
            s = ClaimSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            s.save(item=item, user=request.user)
            return Response(s.data, status=201)
        if item.owner != request.user:
            return Response({"detail": "Only the owner can see claims."}, status=403)
        return Response(ClaimSerializer(item.claims.select_related("user"), many=True).data)

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def matches(self, request, pk=None):
        item = self.get_object()
        opposite = "found" if item.type == "lost" else "lost"
        base = words(item.title + " " + item.description + " " + item.color + " " + item.brand)
        scored = []
        for c in Item.objects.filter(type=opposite, status="open"):
            score = len(base & words(c.title + " " + c.description + " " + c.color + " " + c.brand))
            if c.category == item.category: score += 2
            if c.location.lower() == item.location.lower(): score += 2
            if score >= 3: scored.append((score, c))
        scored.sort(key=lambda s: -s[0])
        return Response(self.get_serializer([c for _, c in scored[:4]], many=True).data)

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def decide_claim(request, pk):
    claim = get_object_or_404(Claim, pk=pk, item__owner=request.user)
    st = request.data.get("status")
    if st not in ("accepted", "rejected"):
        return Response({"detail": "Invalid status."}, status=400)
    claim.status = st
    claim.save()
    if st == "accepted":
        claim.item.status = "resolved"
        claim.item.save()
    return Response(ClaimSerializer(claim).data)

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def stats(request):
    return Response({
        "lost": Item.objects.filter(type="lost", status="open").count(),
        "found": Item.objects.filter(type="found", status="open").count(),
        "returned": Item.objects.filter(status="resolved").count(),
    })

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_items(request):
    return Response(ItemSerializer(Item.objects.filter(owner=request.user), many=True, context={"request": request}).data)

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthRateThrottle])
def register(request):
    s = RegisterSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = s.save()
    return Response({"token": Token.objects.get_or_create(user=user)[0].key, "username": user.username}, status=201)

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthRateThrottle])
def login(request):
    user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
    if not user:
        return Response({"detail": "Wrong username or password."}, status=400)
    return Response({"token": Token.objects.get_or_create(user=user)[0].key, "username": user.username})
