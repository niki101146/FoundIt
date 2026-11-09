from django.conf import settings
from django.db import models

class Item(models.Model):
    TYPES = [("lost", "Lost"), ("found", "Found")]
    CATEGORIES = [("phone", "Phone"), ("electronics", "Electronics"), ("wallet", "Wallet"),
                  ("bag", "Bag / Luggage"), ("keys", "Keys"), ("documents", "Documents / ID"),
                  ("clothing", "Clothing"), ("jewellery", "Jewellery"), ("pet", "Pet"),
                  ("vehicle", "Vehicle"), ("other", "Other")]
    STATUS = [("open", "Open"), ("resolved", "Returned")]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items")
    type = models.CharField(max_length=5, choices=TYPES)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORIES, default="other")
    color = models.CharField(max_length=40, blank=True)
    brand = models.CharField(max_length=60, blank=True)
    location = models.CharField(max_length=200)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    date = models.DateField()
    image = models.ImageField(upload_to="items/", null=True, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    reward = models.CharField(max_length=60, blank=True)
    views = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, choices=STATUS, default="open")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type}: {self.title}"

class Claim(models.Model):
    STATUS = [("pending", "Pending"), ("accepted", "Accepted"), ("rejected", "Rejected")]
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="claims")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
