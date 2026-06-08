<?php

namespace App\Swagger;

/**
 * @OA\Tag(name="Auth", description="Authentification et session")
 * @OA\Tag(name="Users", description="CRUD utilisateurs")
 * @OA\Tag(name="Roles", description="CRUD roles")
 * @OA\Tag(name="Permissions", description="Permissions fixes creees par seeder")
 * @OA\Tag(name="Agents", description="Gestion des agents")
 * @OA\Tag(name="Account Requests", description="Demandes de creation de compte")
 * @OA\Tag(name="Categories", description="Gestion des categories")
 * @OA\Tag(name="Plats", description="Gestion des plats")
 * @OA\Tag(name="Tables", description="Gestion des tables et QR codes")
 * @OA\Tag(name="Orders", description="Gestion des commandes")
 *
 * @OA\SecurityScheme(
 *     securityScheme="sanctum",
 *     type="apiKey",
 *     in="header",
 *     name="Authorization",
 *     description="Bearer {token}"
 * )
 *
 * @OA\Schema(
 *     schema="UserPayload",
 *     required={"first_name","last_name","email"},
 *     @OA\Property(property="first_name", type="string", example="Jean"),
 *     @OA\Property(property="last_name", type="string", example="Dupont"),
 *     @OA\Property(property="email", type="string", example="jean@example.com"),
 *     @OA\Property(property="phone_number", type="string", example="+243900000000"),
 *     @OA\Property(property="address", type="string", example="Kinshasa"),
 *     @OA\Property(property="password", type="string", example="12345678"),
 *     @OA\Property(property="role", type="string", example="manager"),
 *     @OA\Property(property="roles", type="array", @OA\Items(type="string"), example={"manager","caissier"}),
 * )
 *
 * @OA\Schema(
 *     schema="RolePayload",
 *     required={"name"},
 *     @OA\Property(property="name", type="string", example="manager"),
 *     @OA\Property(property="permissions", type="array", @OA\Items(type="string"), example={"users.list","orders.update"})
 * )
 *
 * @OA\Schema(
 *     schema="PermissionPayload",
 *     required={"name"},
 *     @OA\Property(property="name", type="string", example="orders.update")
 * )
 *
 * @OA\Schema(
 *     schema="OrderPayload",
 *     required={"table_id","items"},
 *     @OA\Property(property="table_id", type="string", format="uuid"),
 *     @OA\Property(property="note", type="string", example="Sans piment"),
 *     @OA\Property(
 *         property="items",
 *         type="array",
 *         @OA\Items(
 *             type="object",
 *             required={"plat_id","quantity"},
 *             @OA\Property(property="plat_id", type="string", format="uuid"),
 *             @OA\Property(property="quantity", type="integer", example=2)
 *         )
 *     )
 * )
 *
 * @OA\Schema(
 *     schema="TablePayload",
 *     required={"name","capacity"},
 *     @OA\Property(property="name", type="string", example="Table 1"),
 *     @OA\Property(property="capacity", type="integer", example=4),
 *     @OA\Property(property="server_phone", type="string", example="+243900000000")
 * )
 *
 * @OA\Schema(
 *     schema="AgentPayload",
 *     required={"first_name","last_name","email","phone_number","address","education_level","fonction"},
 *     @OA\Property(property="first_name", type="string", example="Jean"),
 *     @OA\Property(property="last_name", type="string", example="Dupont"),
 *     @OA\Property(property="email", type="string", example="agent@example.com"),
 *     @OA\Property(property="phone_number", type="string", example="+243900000000"),
 *     @OA\Property(property="address", type="string", example="Kinshasa"),
 *     @OA\Property(property="education_level", type="string", example="Licence"),
 *     @OA\Property(property="fonction", type="string", example="Serveur")
 * )
 *
 * @OA\Post(
 *     path="/api/otp/request",
 *     tags={"Auth"},
 *     summary="Demander un nouveau code OTP",
 *     @OA\RequestBody(required=true, @OA\JsonContent(required={"email"}, @OA\Property(property="email", type="string", example="user@example.com"))),
 *     @OA\Response(response=200, description="OTP envoye")
 * )
 * @OA\Post(
 *     path="/api/auth/logout",
 *     tags={"Auth"},
 *     summary="Deconnecter l'utilisateur courant",
 *     security={{"sanctum":{}}},
 *     @OA\Response(response=200, description="Deconnexion reussie")
 * )
 *
 * @OA\Get(path="/api/users/search", tags={"Users"}, summary="Rechercher des utilisateurs", security={{"sanctum":{}}}, @OA\Parameter(name="query", in="query", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Resultats"))
 * @OA\Get(path="/api/users/{id}", tags={"Users"}, summary="Afficher un utilisateur", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Utilisateur"))
 * @OA\Put(path="/api/users/{id}", tags={"Users"}, summary="Modifier un utilisateur", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/UserPayload")), @OA\Response(response=200, description="Utilisateur modifie"))
 * @OA\Delete(path="/api/users/{id}", tags={"Users"}, summary="Supprimer un utilisateur", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Utilisateur supprime"))
 *
 * @OA\Get(path="/api/roles/{id}", tags={"Roles"}, summary="Afficher un role", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="Role"))
 * @OA\Put(path="/api/roles/{id}/permissions", tags={"Roles"}, summary="Synchroniser les permissions d'un role", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\RequestBody(required=true, @OA\JsonContent(required={"permissions"}, @OA\Property(property="permissions", type="array", @OA\Items(type="string"), example={"orders.update"}))), @OA\Response(response=200, description="Permissions mises a jour"))
 *
 * @OA\Get(path="/api/permissions", tags={"Permissions"}, summary="Lister les permissions fixes", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/permissions/search", tags={"Permissions"}, summary="Rechercher des permissions", security={{"sanctum":{}}}, @OA\Parameter(name="query", in="query", required=true, @OA\Schema(type="string")), @OA\Response(response=200, description="Resultats"))
 * @OA\Get(path="/api/permissions/{id}", tags={"Permissions"}, summary="Afficher une permission", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="Permission"))
 *
 * @OA\Post(path="/api/agents/create", tags={"Agents"}, summary="Creer un agent", security={{"sanctum":{}}}, @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/AgentPayload")), @OA\Response(response=201, description="Agent cree"))
 * @OA\Get(path="/api/agents/list", tags={"Agents"}, summary="Lister les agents", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/agents/show/{id}", tags={"Agents"}, summary="Afficher un agent", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Agent"))
 * @OA\Put(path="/api/agents/update/{id}", tags={"Agents"}, summary="Modifier un agent", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/AgentPayload")), @OA\Response(response=200, description="Agent modifie"))
 * @OA\Delete(path="/api/agents/delete/{id}", tags={"Agents"}, summary="Supprimer un agent", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Agent supprime"))
 *
 * @OA\Get(path="/api/category/{id}", tags={"Categories"}, summary="Afficher une categorie", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Categorie"))
 * @OA\Put(path="/api/category/{id}", tags={"Categories"}, summary="Modifier une categorie", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Categorie modifiee"))
 * @OA\Delete(path="/api/category/{id}", tags={"Categories"}, summary="Supprimer une categorie", security={{"sanctum":{}}}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Categorie supprimee"))
 *
 * @OA\Get(path="/api/plats/list", tags={"Plats"}, summary="Lister les plats", security={{"sanctum":{}}}, @OA\Response(response=200, description="Liste"))
 * @OA\Post(path="/api/plats/create", tags={"Plats"}, summary="Creer un plat", security={{"sanctum":{}}}, @OA\Response(response=201, description="Plat cree"))
 *
 * @OA\Post(path="/api/tables", tags={"Tables"}, summary="Creer une table et son QR code", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/TablePayload")), @OA\Response(response=200, description="Table creee"))
 * @OA\Get(path="/api/tables", tags={"Tables"}, summary="Lister les tables", @OA\Response(response=200, description="Liste"))
 * @OA\Get(path="/api/tables/{id}", tags={"Tables"}, summary="Afficher une table", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Table"))
 * @OA\Put(path="/api/tables/{id}", tags={"Tables"}, summary="Modifier une table", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(@OA\JsonContent(ref="#/components/schemas/TablePayload")), @OA\Response(response=200, description="Table modifiee"))
 * @OA\Delete(path="/api/tables/{id}", tags={"Tables"}, summary="Supprimer une table", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Table supprimee"))
 *
 * @OA\Post(path="/api/orders", tags={"Orders"}, summary="Creer une commande", @OA\RequestBody(required=true, @OA\JsonContent(ref="#/components/schemas/OrderPayload")), @OA\Response(response=201, description="Commande creee"))
 * @OA\Get(path="/api/orders", tags={"Orders"}, summary="Lister les commandes", @OA\Parameter(name="day", in="query", required=false, @OA\Schema(type="string", format="date")), @OA\Parameter(name="month", in="query", required=false, @OA\Schema(type="integer")), @OA\Parameter(name="year", in="query", required=false, @OA\Schema(type="integer")), @OA\Response(response=200, description="Liste"))
 * @OA\Delete(path="/api/orders", tags={"Orders"}, summary="Vider l'historique des commandes", @OA\Response(response=200, description="Historique vide"))
 * @OA\Get(path="/api/orders/{id}", tags={"Orders"}, summary="Afficher une commande", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Commande"))
 * @OA\Delete(path="/api/orders/{id}", tags={"Orders"}, summary="Supprimer une commande", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\Response(response=200, description="Commande supprimee"))
 * @OA\Patch(path="/api/orders/{id}/status", tags={"Orders"}, summary="Changer le statut d'une commande", @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")), @OA\RequestBody(required=true, @OA\JsonContent(required={"status"}, @OA\Property(property="status", type="string", enum={"pending","preparing","ready","delivered","paid","cancelled"}, example="ready"))), @OA\Response(response=200, description="Statut modifie"))
 */
class ApiDocumentation
{
}
