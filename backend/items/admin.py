from django.contrib import admin
from .models import Item, Claim
@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "category", "location", "status", "owner", "created_at")
    list_filter = ("type", "category", "status")
    search_fields = ("title", "description", "location")
admin.site.register(Claim)
