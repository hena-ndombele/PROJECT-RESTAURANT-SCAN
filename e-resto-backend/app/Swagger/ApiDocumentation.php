<?php

namespace App\Swagger;

/**
 * @OA\Tag(name="Auth", description="Authentification, OTP et session")
 * @OA\Tag(name="SaaS", description="Landing, plans, abonnement, restaurants et paiement SaaS")
 * @OA\Tag(name="Public Client", description="Endpoints publics utilises par l'application client")
 * @OA\Tag(name="Users", description="Gestion des utilisateurs autorises a se connecter")
 * @OA\Tag(name="Roles", description="Gestion des roles et permissions")
 * @OA\Tag(name="Permissions", description="Liste et recherche des permissions")
 * @OA\Tag(name="Agents", description="Gestion des employes et verification badge")
 * @OA\Tag(name="Categories", description="Gestion des categories du menu")
 * @OA\Tag(name="Plats", description="Gestion des plats")
 * @OA\Tag(name="Tables", description="Gestion des tables et QR codes")
 * @OA\Tag(name="Orders", description="Commandes client et traitement restaurant")
 * @OA\Tag(name="Reservations", description="Reservations publiques et gestion restaurant")
 * @OA\Tag(name="Feedbacks", description="Avis clients")
 *
 * @OA\SecurityScheme(
 *     securityScheme="sanctum",
 *     type="apiKey",
 *     in="header",
 *     name="Authorization",
 *     description="Bearer {token}"
 * )
 *
 * @OA\Schema(schema="Uuid", type="string", format="uuid", example="019edc53-3fa2-7013-821f-b44c62ca24eb")
 * @OA\Schema(schema="MessageResponse", type="object", @OA\Property(property="message", type="string", example="Operation reussie"))
 * @OA\Schema(schema="ErrorResponse", type="object", @OA\Property(property="message", type="string", example="Une erreur est survenue"), @OA\Property(property="errors", type="object"))
 *
 * @OA\Schema(
 *     schema="LoginPayload",
 *     required={"email","password"},
 *     @OA\Property(property="email", type="string", format="email", example="restaurant@example.com"),
 *     @OA\Property(property="password", type="string", format="password", example="secret123")
 * )
 *
 * @OA\Schema(
 *     schema="OtpPayload",
 *     required={"email","otp"},
 *     @OA\Property(property="email", type="string", format="email", example="restaurant@example.com"),
 *     @OA\Property(property="otp", type="string", example="123456")
 * )
 *
 * @OA\Schema(
 *     schema="SaasSignupPayload",
 *     required={"restaurant_name","owner_name","owner_email","owner_phone","saas_plan_id"},
 *     @OA\Property(property="restaurant_name", type="string", example="Restaurant Chic"),
 *     @OA\Property(property="legal_name", type="string", nullable=true, example="Restaurant Chic SARL"),
 *     @OA\Property(property="owner_name", type="string", example="Hena Ndombele"),
 *     @OA\Property(property="owner_email", type="string", format="email", example="owner@example.com"),
 *     @OA\Property(property="owner_phone", type="string", example="+243900000000"),
 *     @OA\Property(property="password", type="string", nullable=true, example="secret123"),
 *     @OA\Property(property="password_confirmation", type="string", nullable=true, example="secret123"),
 *     @OA\Property(property="google_credential", type="string", nullable=true),
 *     @OA\Property(property="address", type="string", nullable=true, example="Kinshasa"),
 *     @OA\Property(property="city", type="string", nullable=true, example="Kinshasa"),
 *     @OA\Property(property="country", type="string", nullable=true, example="CD"),
 *     @OA\Property(property="currency", type="string", enum={"USD","CDF"}, example="USD"),
 *     @OA\Property(property="saas_plan_id", type="string", example="business")
 * )
 *
 * @OA\Schema(
 *     schema="PlanPayload",
 *     required={"name","monthly_price","annual_price"},
 *     @OA\Property(property="name", type="string", example="Business"),
 *     @OA\Property(property="slug", type="string", example="business"),
 *     @OA\Property(property="monthly_price", type="number", example=30),
 *     @OA\Property(property="annual_price", type="number", example=25),
 *     @OA\Property(property="currency", type="string", example="USD"),
 *     @OA\Property(property="max_users", type="integer", nullable=true, example=null),
 *     @OA\Property(property="max_tables", type="integer", nullable=true, example=null),
 *     @OA\Property(property="max_plats", type="integer", nullable=true, example=null),
 *     @OA\Property(property="max_orders_per_month", type="integer", nullable=true, example=null),
 *     @OA\Property(property="features", type="array", @OA\Items(type="string"), example={"Plats illimites","Tables illimitees"}),
 *     @OA\Property(property="is_active", type="boolean", example=true)
 * )
 *
 * @OA\Schema(
 *     schema="RestaurantProfilePayload",
 *     @OA\Property(property="name", type="string", example="Restaurant Chic"),
 *     @OA\Property(property="slug", type="string", example="restaurant-chic"),
 *     @OA\Property(property="owner_phone", type="string", example="+243900000000"),
 *     @OA\Property(property="address", type="string", example="Kinshasa"),
 *     @OA\Property(property="city", type="string", example="Kinshasa"),
 *     @OA\Property(property="currency", type="string", enum={"USD","CDF"}, example="USD"),
 *     @OA\Property(property="primary_color", type="string", example="#F9A11B"),
 *     @OA\Property(property="logo", type="string", nullable=true, description="Base64 ou chemin selon le formulaire"),
 *     @OA\Property(property="settings", type="object")
 * )
 *
 * @OA\Schema(
 *     schema="AgentPayload",
 *     required={"first_name","last_name","email","phone_number","address","education_level","fonction","matricule"},
 *     @OA\Property(property="first_name", type="string", example="Jean"),
 *     @OA\Property(property="last_name", type="string", example="Dupont"),
 *     @OA\Property(property="email", type="string", format="email", example="agent@example.com"),
 *     @OA\Property(property="phone_number", type="string", example="+243900000000"),
 *     @OA\Property(property="address", type="string", example="Kinshasa"),
 *     @OA\Property(property="education_level", type="string", example="Licence"),
 *     @OA\Property(property="fonction", type="string", example="Serveur"),
 *     @OA\Property(property="matricule", type="string", example="EMP-001"),
 *     @OA\Property(property="photo", type="string", format="binary", nullable=true)
 * )
 *
 * @OA\Schema(
 *     schema="UserPayload",
 *     required={"agent_id","role"},
 *     @OA\Property(property="agent_id", ref="#/components/schemas/Uuid"),
 *     @OA\Property(property="role", type="string", example="manager"),
 *     @OA\Property(property="roles", type="array", @OA\Items(type="string"), example={"manager","caissier"})
 * )
 *
 * @OA\Schema(
 *     schema="RolePayload",
 *     required={"name"},
 *     @OA\Property(property="name", type="string", example="manager"),
 *     @OA\Property(property="permissions", type="array", @OA\Items(type="string"), example={"orders.list","orders.update"})
 * )
 *
 * @OA\Schema(
 *     schema="CategoryPayload",
 *     required={"name"},
 *     @OA\Property(property="name", type="string", example="Burgers"),
 *     @OA\Property(property="description", type="string", nullable=true),
 *     @OA\Property(property="image", type="string", format="binary", nullable=true)
 * )
 *
 * @OA\Schema(
 *     schema="PlatPayload",
 *     required={"name","price","category_id"},
 *     @OA\Property(property="name", type="string", example="Pizza"),
 *     @OA\Property(property="description", type="string", nullable=true),
 *     @OA\Property(property="price", type="number", example=14),
 *     @OA\Property(property="currency", type="string", enum={"USD","CDF"}, example="USD"),
 *     @OA\Property(property="category_id", ref="#/components/schemas/Uuid"),
 *     @OA\Property(property="preparation_time", type="integer", nullable=true, example=20),
 *     @OA\Property(property="ingredients", type="array", @OA\Items(type="string"), example={"Fromage","Tomate"}),
 *     @OA\Property(property="is_available", type="boolean", example=true),
 *     @OA\Property(property="image", type="string", format="binary", nullable=true)
 * )
 *
 * @OA\Schema(
 *     schema="TablePayload",
 *     required={"name","capacity"},
 *     @OA\Property(property="name", type="string", example="TABLE 4"),
 *     @OA\Property(property="capacity", type="integer", example=4),
 *     @OA\Property(property="server_phone", type="string", nullable=true, example="+243900000000"),
 *     @OA\Property(property="status", type="string", nullable=true, example="Libre")
 * )
 *
 * @OA\Schema(
 *     schema="OrderPayload",
 *     required={"items"},
 *     @OA\Property(property="table_id", ref="#/components/schemas/Uuid", nullable=true),
 *     @OA\Property(property="restaurant_id", ref="#/components/schemas/Uuid", nullable=true),
 *     @OA\Property(property="restaurant_slug", type="string", nullable=true, example="restaurant-chic"),
 *     @OA\Property(property="order_type", type="string", enum={"dine_in","takeaway","remote"}, example="dine_in"),
 *     @OA\Property(property="note", type="string", nullable=true, example="Sans piment"),
 *     @OA\Property(property="payment_method", type="string", enum={"cash"}, example="cash"),
 *     @OA\Property(property="customer_name", type="string", nullable=true, example="Client"),
 *     @OA\Property(property="customer_phone", type="string", nullable=true, example="+243900000000"),
 *     @OA\Property(property="customer_email", type="string", nullable=true, format="email"),
 *     @OA\Property(property="items", type="array", @OA\Items(type="object", required={"plat_id","quantity"}, @OA\Property(property="plat_id", ref="#/components/schemas/Uuid"), @OA\Property(property="quantity", type="integer", example=2)))
 * )
 *
 * @OA\Schema(
 *     schema="ReservationPayload",
 *     required={"restaurant_id","name","phone","reservation_date","reservation_time","guests"},
 *     @OA\Property(property="restaurant_id", ref="#/components/schemas/Uuid"),
 *     @OA\Property(property="table_id", ref="#/components/schemas/Uuid", nullable=true),
 *     @OA\Property(property="name", type="string", example="Client"),
 *     @OA\Property(property="phone", type="string", example="+243900000000"),
 *     @OA\Property(property="email", type="string", nullable=true, format="email"),
 *     @OA\Property(property="reservation_date", type="string", format="date", example="2026-06-21"),
 *     @OA\Property(property="reservation_time", type="string", example="19:30"),
 *     @OA\Property(property="guests", type="integer", example=4),
 *     @OA\Property(property="note", type="string", nullable=true)
 * )
 *
 * @OA\Schema(
 *     schema="FeedbackPayload",
 *     required={"order_id","rating"},
 *     @OA\Property(property="order_id", ref="#/components/schemas/Uuid"),
 *     @OA\Property(property="rating", type="integer", minimum=1, maximum=5, example=5),
 *     @OA\Property(property="comment", type="string", nullable=true),
 *     @OA\Property(property="recommended", type="boolean", nullable=true)
 * )
 *
 * @OA\Schema(
 *     schema="ContactPayload",
 *     required={"name","email","message"},
 *     @OA\Property(property="name", type="string", example="Client"),
 *     @OA\Property(property="email", type="string", format="email", example="client@example.com"),
 *     @OA\Property(property="phone", type="string", nullable=true),
 *     @OA\Property(property="message", type="string", example="Bonjour")
 * )
 *
 * @OA\Post(path="/api/auth/login", tags={"Auth"}, summary="Connexion utilisateur restaurant", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/LoginPayload")), @OA\Response(response=200, description="OTP ou token"), @OA\Response(response=401, description="Identifiants incorrects"))
 * @OA\Post(path="/api/auth/verify-otp", tags={"Auth"}, summary="Verifier OTP restaurant", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/OtpPayload")), @OA\Response(response=200, description="Session creee"))
 * @OA\Post(path="/api/admin/auth/login", tags={"Auth"}, summary="Connexion admin plateforme", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/LoginPayload")), @OA\Response(response=200, description="OTP ou token"))
 * @OA\Post(path="/api/admin/auth/verify-otp", tags={"Auth"}, summary="Verifier OTP admin plateforme", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/OtpPayload")), @OA\Response(response=200, description="Session admin creee"))
 * @OA\Post(path="/api/otp/request", tags={"Auth"}, summary="Renvoyer un code OTP", @OA\RequestBody(required=true, @OA\JsonContent(required={"email"}, @OA\Property(property="email", type="string", format="email"))), @OA\Response(response=200, description="OTP envoye"))
 * @OA\Post(path="/api/auth/logout", tags={"Auth"}, summary="Deconnecter l'utilisateur courant", security={{"sanctum":{}}}, @OA\Response(response=200, description="Deconnexion reussie"))
 * @OA\Post(path="/api/auth/change-password", tags={"Auth"}, summary="Changer le mot de passe", security={{"sanctum":{}}}, @OA\RequestBody(required=true, @OA\JsonContent(required={"current_password","new_password","new_password_confirmation"}, @OA\Property(property="current_password", type="string"), @OA\Property(property="new_password", type="string"), @OA\Property(property="new_password_confirmation", type="string"))), @OA\Response(response=200, description="Mot de passe modifie"))
 *
 * @OA\Get(path="/api/saas/overview", tags={"SaaS"}, summary="Vue publique SaaS", @OA\Response(response=200, description="Metriques publiques"))
 * @OA\Get(path="/api/saas/plans", tags={"SaaS"}, summary="Lister les plans SaaS", @OA\Response(response=200, description="Plans actifs"))
 * @OA\Post(path="/api/saas/newsletter", tags={"SaaS"}, summary="Inscription newsletter", @OA\RequestBody(required=true, @OA\JsonContent(required={"email"}, @OA\Property(property="email", type="string", format="email"), @OA\Property(property="source", type="string", example="saas_landing"))), @OA\Response(response=201, description="Inscrit"))
 * @OA\Post(path="/api/saas/signup", tags={"SaaS"}, summary="Creer un compte restaurant", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/SaasSignupPayload")), @OA\Response(response=201, description="Restaurant cree"), @OA\Response(response=422, description="Validation"))
 * @OA\Post(path="/api/saas/login", tags={"SaaS"}, summary="Connexion proprietaire restaurant", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/LoginPayload")), @OA\Response(response=200, description="Session restaurant"))
 * @OA\Get(path="/api/saas/google/config", tags={"SaaS"}, summary="Configuration Google OAuth", @OA\Response(response=200, description="Config"))
 * @OA\Post(path="/api/saas/google/login", tags={"SaaS"}, summary="Connexion/inscription via Google", @OA\RequestBody(required=true, @OA\JsonContent(required={"credential"}, @OA\Property(property="credential", type="string"))), @OA\Response(response=200, description="Session Google"))
 * @OA\Post(path="/api/saas/checkout/mobile-money", tags={"SaaS"}, summary="Lancer paiement abonnement mobile money", @OA\RequestBody(required=true, @OA\JsonContent(@OA\Property(property="restaurant_id", ref="#/components/schemas/Uuid"), @OA\Property(property="saas_plan_id", type="string"), @OA\Property(property="phone", type="string"), @OA\Property(property="billing_cycle", type="string", enum={"monthly","annual"}))), @OA\Response(response=200, description="Paiement initialise"))
 * @OA\Get(path="/api/saas/checkout/mobile-money/{payment}", tags={"SaaS"}, summary="Statut paiement abonnement", @OA\Parameter(name="payment", in="path", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Statut paiement"))
 * @OA\Post(path="/api/saas/payment-callback", tags={"SaaS"}, summary="Callback paiement abonnement", @OA\Response(response=200, description="Callback traite"))
 * @OA\Post(path="/api/saas/register-interest", tags={"SaaS"}, summary="Enregistrer une demande/interet", @OA\Response(response=201, description="Demande enregistree"))
 * @OA\Get(path="/api/saas/me", tags={"SaaS"}, summary="Session restaurant courante", security={{"sanctum":{}}}, @OA\Response(response=200, description="Profil courant"))
 * @OA\Get(path="/api/saas/restaurant/usage", tags={"SaaS"}, summary="Usage et limites du restaurant", security={{"sanctum":{}}}, @OA\Response(response=200, description="Usage"))
 * @OA\Put(path="/api/saas/restaurant/profile", tags={"SaaS"}, summary="Modifier profil/parametres restaurant", security={{"sanctum":{}}}, @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/RestaurantProfilePayload")), @OA\Response(response=200, description="Restaurant modifie"))
 * @OA\Post(path="/api/saas/plans", tags={"SaaS"}, summary="Admin: creer un plan", security={{"sanctum":{}}}, @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/PlanPayload")), @OA\Response(response=201, description="Plan cree"))
 * @OA\Put(path="/api/saas/plans/{plan}", tags={"SaaS"}, summary="Admin: modifier un plan", security={{"sanctum":{}}}, @OA\Parameter(name="plan", in="path", required=true, @OA\Schema(type="string")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/PlanPayload")), @OA\Response(response=200, description="Plan modifie"))
 * @OA\Delete(path="/api/saas/plans/{plan}", tags={"SaaS"}, summary="Admin: supprimer un plan", security={{"sanctum":{}}}, @OA\Parameter(name="plan", in="path", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Plan supprime"))
 * @OA\Get(path="/api/saas/wallet/balance", tags={"SaaS"}, summary="Admin: solde wallet", security={{"sanctum":{}}}, @OA\Response(response=200, description="Solde"))
 * @OA\Get(path="/api/saas/support", tags={"SaaS"}, summary="Admin: centre support", security={{"sanctum":{}}}, @OA\Response(response=200, description="Support"))
 * @OA\Get(path="/api/saas/contact-messages", tags={"SaaS"}, summary="Admin: messages contact", security={{"sanctum":{}}}, @OA\Response(response=200, description="Messages"))
 * @OA\Get(path="/api/saas/newsletter-subscribers", tags={"SaaS"}, summary="Admin: abonnes newsletter", security={{"sanctum":{}}}, @OA\Response(response=200, description="Abonnes"))
 * @OA\Get(path="/api/saas/audit", tags={"SaaS"}, summary="Admin: audit trail", security={{"sanctum":{}}}, @OA\Response(response=200, description="Audit"))
 * @OA\Get(path="/api/saas/payments", tags={"SaaS"}, summary="Admin: paiements", security={{"sanctum":{}}}, @OA\Response(response=200, description="Paiements"))
 * @OA\Get(path="/api/saas/restaurants", tags={"SaaS"}, summary="Admin: restaurants", security={{"sanctum":{}}}, @OA\Response(response=200, description="Restaurants"))
 * @OA\Post(path="/api/saas/restaurants", tags={"SaaS"}, summary="Admin: creer restaurant", security={{"sanctum":{}}}, @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/RestaurantProfilePayload")), @OA\Response(response=201, description="Restaurant cree"))
 * @OA\Put(path="/api/saas/restaurants/{restaurant}", tags={"SaaS"}, summary="Admin: modifier restaurant", security={{"sanctum":{}}}, @OA\Parameter(name="restaurant", in="path", required=true, @OA\Schema(type="string")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/RestaurantProfilePayload")), @OA\Response(response=200, description="Restaurant modifie"))
 * @OA\Post(path="/api/saas/restaurants/{restaurant}/reset-owner-password", tags={"SaaS"}, summary="Admin: reinitialiser mot de passe proprietaire", security={{"sanctum":{}}}, @OA\Parameter(name="restaurant", in="path", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Mot de passe reinitialise"))
 * @OA\Delete(path="/api/saas/restaurants/{restaurant}", tags={"SaaS"}, summary="Admin: supprimer restaurant", security={{"sanctum":{}}}, @OA\Parameter(name="restaurant", in="path", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Restaurant supprime"))
 *
 * @OA\Get(path="/api/public/menu", tags={"Public Client"}, summary="Menu public client", @OA\Parameter(name="table_id", in="query", required=false, @OA\Schema(type="string", format="uuid")), @OA\Parameter(name="restaurant_id", in="query", required=false, @OA\Schema(type="string", format="uuid")), @OA\Parameter(name="restaurant_slug", in="query", required=false, @OA\Schema(type="string")), @OA\Parameter(name="category_id", in="query", required=false, @OA\Schema(type="string")), @OA\Parameter(name="search", in="query", required=false, @OA\Schema(type="string")), @OA\Response(response=200, description="Menu public"))
 * @OA\Post(path="/api/public/contact", tags={"Public Client"}, summary="Message contact public", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/ContactPayload")), @OA\Response(response=201, description="Message cree"))
 * @OA\Post(path="/api/public/reservations", tags={"Reservations"}, summary="Creer reservation publique", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/ReservationPayload")), @OA\Response(response=201, description="Reservation creee"))
 * @OA\Post(path="/api/public/feedbacks", tags={"Feedbacks"}, summary="Creer feedback public", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/FeedbackPayload")), @OA\Response(response=201, description="Feedback cree"))
 * @OA\Get(path="/api/public/employees/verify/{id}", tags={"Agents"}, summary="Verifier badge employe public", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Parameter(name="token", in="query", required=false, @OA\Schema(type="string")), @OA\Response(response=200, description="Badge valide"), @OA\Response(response=404, description="Badge invalide"))
 *
 * @OA\Post(path="/api/agents/create", tags={"Agents"}, summary="Creer un employe", security={{"sanctum":{}}}, @OA\RequestBody(required=true, @OA\MediaType(mediaType="multipart/form-data", @OA\Schema(ref="#/components/schemas/AgentPayload"))), @OA\Response(response=201, description="Employe cree"))
 * @OA\Get(path="/api/agents/list", tags={"Agents"}, summary="Lister les employes", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/agents/show/{id}", tags={"Agents"}, summary="Afficher un employe", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Employe"))
 * @OA\Put(path="/api/agents/update/{id}", tags={"Agents"}, summary="Modifier un employe", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\MediaType(mediaType="multipart/form-data", @OA\Schema(ref="#/components/schemas/AgentPayload"))), @OA\Response(response=200, description="Employe modifie"))
 * @OA\Delete(path="/api/agents/delete/{id}", tags={"Agents"}, summary="Supprimer un employe", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Employe supprime"))
 *
 * @OA\Post(path="/api/auth/register", tags={"Users"}, summary="Ajouter un employe comme user", security={{"sanctum":{}}}, @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/UserPayload")), @OA\Response(response=201, description="Utilisateur cree"))
 * @OA\Get(path="/api/users/list", tags={"Users"}, summary="Lister les users", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/users/search", tags={"Users"}, summary="Rechercher les users", security={{"sanctum":{}}}, @OA\Parameter(name="query", in="query", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Resultats"))
 * @OA\Get(path="/api/users/{id}", tags={"Users"}, summary="Afficher un user", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Utilisateur"))
 * @OA\Put(path="/api/users/{id}", tags={"Users"}, summary="Modifier un user", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/UserPayload")), @OA\Response(response=200, description="Utilisateur modifie"))
 * @OA\Delete(path="/api/users/{id}", tags={"Users"}, summary="Supprimer un user", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Utilisateur supprime"))
 *
 * @OA\Post(path="/api/roles", tags={"Roles"}, summary="Creer un role", security={{"sanctum":{}}}, @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/RolePayload")), @OA\Response(response=201, description="Role cree"))
 * @OA\Get(path="/api/roles", tags={"Roles"}, summary="Lister les roles", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/roles/search", tags={"Roles"}, summary="Rechercher les roles", security={{"sanctum":{}}}, @OA\Parameter(name="query", in="query", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Resultats"))
 * @OA\Get(path="/api/roles/{id}", tags={"Roles"}, summary="Afficher un role", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="Role"))
 * @OA\Put(path="/api/roles/{id}", tags={"Roles"}, summary="Modifier un role", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/RolePayload")), @OA\Response(response=200, description="Role modifie"))
 * @OA\Put(path="/api/roles/{id}/permissions", tags={"Roles"}, summary="Synchroniser permissions role", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\RequestBody(required=true, @OA\JsonContent(required={"permissions"}, @OA\Property(property="permissions", type="array", @OA\Items(type="string"), example={"orders.list","orders.update"}))), @OA\Response(response=200, description="Permissions mises a jour"))
 * @OA\Delete(path="/api/roles/{id}", tags={"Roles"}, summary="Supprimer un role", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="Role supprime"))
 * @OA\Get(path="/api/permissions", tags={"Permissions"}, summary="Lister les permissions", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/permissions/search", tags={"Permissions"}, summary="Rechercher permissions", security={{"sanctum":{}}}, @OA\Parameter(name="query", in="query", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Resultats"))
 * @OA\Get(path="/api/permissions/{id}", tags={"Permissions"}, summary="Afficher permission", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="Permission"))
 *
 * @OA\Get(path="/api/category/list", tags={"Categories"}, summary="Lister categories", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Post(path="/api/category/create", tags={"Categories"}, summary="Creer categorie", security={{"sanctum":{}}}, @OA\RequestBody(@OA\MediaType(mediaType="multipart/form-data", @OA\Schema(ref="#/components/schemas/CategoryPayload"))), @OA\Response(response=201, description="Categorie creee"))
 * @OA\Get(path="/api/category/search", tags={"Categories"}, summary="Rechercher categories", security={{"sanctum":{}}}, @OA\Parameter(name="query", in="query", required=false, @OA\Schema(type="string")), @OA\Response(response=200, description="Resultats"))
 * @OA\Get(path="/api/category/{id}", tags={"Categories"}, summary="Afficher categorie", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Categorie"))
 * @OA\Post(path="/api/category/{id}", tags={"Categories"}, summary="Modifier categorie multipart", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\MediaType(mediaType="multipart/form-data", @OA\Schema(ref="#/components/schemas/CategoryPayload"))), @OA\Response(response=200, description="Categorie modifiee"))
 * @OA\Put(path="/api/category/{id}", tags={"Categories"}, summary="Modifier categorie JSON", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/CategoryPayload")), @OA\Response(response=200, description="Categorie modifiee"))
 * @OA\Delete(path="/api/category/{id}", tags={"Categories"}, summary="Supprimer categorie", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Categorie supprimee"))
 *
 * @OA\Get(path="/api/plats/list", tags={"Plats"}, summary="Lister plats", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Post(path="/api/plats/create", tags={"Plats"}, summary="Creer plat", security={{"sanctum":{}}}, @OA\RequestBody(@OA\MediaType(mediaType="multipart/form-data", @OA\Schema(ref="#/components/schemas/PlatPayload"))), @OA\Response(response=201, description="Plat cree"))
 * @OA\Get(path="/api/search-plats", tags={"Plats"}, summary="Rechercher plats", security={{"sanctum":{}}}, @OA\Parameter(name="query", in="query", required=false, @OA\Schema(type="string")), @OA\Response(response=200, description="Resultats"))
 * @OA\Get(path="/api/plats/{id}", tags={"Plats"}, summary="Afficher plat", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Plat"))
 * @OA\Post(path="/api/plats/{id}", tags={"Plats"}, summary="Modifier plat multipart", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\MediaType(mediaType="multipart/form-data", @OA\Schema(ref="#/components/schemas/PlatPayload"))), @OA\Response(response=200, description="Plat modifie"))
 * @OA\Put(path="/api/plats/{id}", tags={"Plats"}, summary="Modifier plat JSON", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/PlatPayload")), @OA\Response(response=200, description="Plat modifie"))
 * @OA\Delete(path="/api/plats/{id}", tags={"Plats"}, summary="Supprimer plat", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Plat supprime"))
 *
 * @OA\Get(path="/api/tables", tags={"Tables"}, summary="Lister tables", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Post(path="/api/tables", tags={"Tables"}, summary="Creer table et QR code", security={{"sanctum":{}}}, @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/TablePayload")), @OA\Response(response=201, description="Table creee"))
 * @OA\Get(path="/api/tables/{id}", tags={"Tables"}, summary="Afficher table", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Table"))
 * @OA\Put(path="/api/tables/{id}", tags={"Tables"}, summary="Modifier table", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/TablePayload")), @OA\Response(response=200, description="Table modifiee"))
 * @OA\Delete(path="/api/tables/{id}", tags={"Tables"}, summary="Supprimer table", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Table supprimee"))
 *
 * @OA\Post(path="/api/orders", tags={"Orders"}, summary="Creer commande client", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/OrderPayload")), @OA\Response(response=201, description="Commande creee"))
 * @OA\Get(path="/api/orders/track", tags={"Orders"}, summary="Retrouver commande client", @OA\Parameter(name="code", in="query", required=false, @OA\Schema(type="string")), @OA\Parameter(name="order_id", in="query", required=false, @OA\Schema(type="string", format="uuid")), @OA\Parameter(name="table_id", in="query", required=false, @OA\Schema(type="string", format="uuid")), @OA\Parameter(name="phone", in="query", required=false, @OA\Schema(type="string")), @OA\Response(response=200, description="Commande trouvee"))
 * @OA\Post(path="/api/orders/payment-callback", tags={"Orders"}, summary="Callback paiement commande", @OA\Response(response=200, description="Callback traite"))
 * @OA\Patch(path="/api/orders/{id}/cancel", tags={"Orders"}, summary="Annuler commande cote client", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(required=true, @OA\JsonContent(required={"cancellation_reason"}, @OA\Property(property="cancellation_reason", type="string", example="Erreur de commande"))), @OA\Response(response=200, description="Commande annulee"))
 * @OA\Patch(path="/api/orders/{id}/items", tags={"Orders"}, summary="Modifier articles avant preparation", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/OrderPayload")), @OA\Response(response=200, description="Articles modifies"))
 * @OA\Patch(path="/api/orders/{id}/request-bill", tags={"Orders"}, summary="Demander addition", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Addition demandee"))
 * @OA\Get(path="/api/orders/{id}", tags={"Orders"}, summary="Afficher commande", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Commande"))
 * @OA\Get(path="/api/orders", tags={"Orders"}, summary="Lister commandes restaurant", security={{"sanctum":{}}}, @OA\Parameter(name="day", in="query", required=false, @OA\Schema(type="string", format="date")), @OA\Parameter(name="month", in="query", required=false, @OA\Schema(type="integer")), @OA\Parameter(name="year", in="query", required=false, @OA\Schema(type="integer")), @OA\Response(response=200, description="Liste"))
 * @OA\Delete(path="/api/orders", tags={"Orders"}, summary="Vider historique commandes", security={{"sanctum":{}}}, @OA\Response(response=200, description="Historique vide"))
 * @OA\Delete(path="/api/orders/{id}", tags={"Orders"}, summary="Supprimer commande", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Commande supprimee"))
 * @OA\Patch(path="/api/orders/{id}/status", tags={"Orders"}, summary="Changer statut commande", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(required=true, @OA\JsonContent(required={"status"}, @OA\Property(property="status", type="string", enum={"pending","preparing","ready","delivered","cancelled"}, example="ready"), @OA\Property(property="cancellation_reason", type="string", nullable=true))), @OA\Response(response=200, description="Statut modifie"))
 * @OA\Patch(path="/api/orders/{id}/payment", tags={"Orders"}, summary="Changer paiement commande", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(required=true, @OA\JsonContent(required={"payment_status"}, @OA\Property(property="payment_status", type="string", enum={"unpaid","pending","paid","failed","refunded"}, example="paid"), @OA\Property(property="method", type="string", nullable=true), @OA\Property(property="received_amount", type="number", nullable=true), @OA\Property(property="note", type="string", nullable=true))), @OA\Response(response=200, description="Paiement modifie"))
 *
 * @OA\Get(path="/api/feedbacks", tags={"Feedbacks"}, summary="Lister feedbacks restaurant", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/reservations", tags={"Reservations"}, summary="Lister reservations", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Patch(path="/api/reservations/{id}/status", tags={"Reservations"}, summary="Changer statut reservation", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(required=true, @OA\JsonContent(required={"status"}, @OA\Property(property="status", type="string", enum={"pending","confirmed","cancelled","completed"}, example="confirmed"), @OA\Property(property="cancellation_reason", type="string", nullable=true))), @OA\Response(response=200, description="Reservation modifiee"))
 * @OA\Delete(path="/api/reservations/{id}", tags={"Reservations"}, summary="Supprimer reservation", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Reservation supprimee"))
 */
class ApiDocumentation
{
}
