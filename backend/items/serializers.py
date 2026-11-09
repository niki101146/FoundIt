from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Item, Claim

class ItemSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.username", read_only=True)
    is_mine = serializers.SerializerMethodField()
    claims_count = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = "__all__"
        read_only_fields = ["owner", "status", "created_at", "views"]

    def get_is_mine(self, obj):
        r = self.context.get("request")
        return bool(r and r.user.is_authenticated and obj.owner_id == r.user.id)

    def get_claims_count(self, obj):
        return obj.claims.filter(status="pending").count()

    def to_representation(self, obj):
        d = super().to_representation(obj)
        r = self.context.get("request")
        if not (r and r.user.is_authenticated):
            d["contact_phone"] = ""
        return d

class ClaimSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    class Meta:
        model = Claim
        fields = ["id", "item", "user_name", "message", "phone", "status", "created_at"]
        read_only_fields = ["item", "status", "created_at"]

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "email", "password"]
        extra_kwargs = {"password": {"write_only": True, "min_length": 6}}
    def create(self, data):
        return User.objects.create_user(**data)
