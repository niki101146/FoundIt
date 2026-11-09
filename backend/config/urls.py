from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [path("admin/", admin.site.urls), path("api/", include("items.urls"))]

# Local development only. In production, photos are served by Cloudinary
# (or by a persistent disk if you add one on Render).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
