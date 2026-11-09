from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
router = DefaultRouter()
router.register("items", views.ItemViewSet, basename="item")
urlpatterns = [
    path("register/", views.register), path("login/", views.login),
    path("stats/", views.stats), path("my-items/", views.my_items),
    path("claims/<int:pk>/decide/", views.decide_claim),
    path("", include(router.urls)),
]
