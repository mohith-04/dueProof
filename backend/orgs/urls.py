from django.urls import path

from orgs import views

auth_urlpatterns = [
    path("csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("signup/", views.SignupView.as_view(), name="auth-signup"),
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("invites/<str:token>/", views.InviteDetailView.as_view(), name="invite-detail"),
    path("invites/<str:token>/accept/", views.InviteAcceptView.as_view(), name="invite-accept"),
]

org_urlpatterns = [
    path("", views.OrganizationView.as_view(), name="org"),
    path("members/", views.MemberListView.as_view(), name="org-members"),
    path("invites/", views.InviteListView.as_view(), name="org-invites"),
]
