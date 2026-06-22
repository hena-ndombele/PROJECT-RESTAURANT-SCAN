# E-RESTO Angular - Dashboard restaurant

`e-resto-Angular` est l'application Angular utilisee par les restaurants pour administrer leur espace SaaS E-RESTO.

Elle gere notamment :

- la landing SaaS et les plans ;
- la creation de compte restaurant ;
- le checkout d'abonnement ;
- le dashboard restaurant ;
- les commandes, plats, categories, tables, Réservations, feedbacks et utilisateurs ;
- l'affichage des informations d'abonnement et de connexion dans l'administration.

## Flow session restaurant

Une session restaurant est creee apres :

```txt
/restaurant/login
creation de compte restaurant
checkout Mobile Money avec session retournee
```

Les donnees principales sont stockees dans `localStorage` :

```txt
restaurant_token
auth_token
user_data
restaurant_session
restaurant_login_at
```

`restaurant_session` contient le restaurant, son plan, son statut et ses dates d'essai ou d'abonnement.

## Flow abonnement dans l'administration

Le layout du dashboard lit `restaurant_session` au chargement.

Il calcule ensuite les jours restants avec :

```txt
trial_ends_at             pour un restaurant en essai
subscription_ends_at      pour un restaurant actif/paye
subscription.ends_at      fallback subscription
current_period_end        fallback periode courante
```

Regles d'affichage :

```txt
trial           => X jours d'essai restants
active          => X jours d'abonnement restants
pending_payment => Paiement en attente
past_due/expired=> Abonnement expire
suspended       => Abonnement suspendu
cancelled       => Abonnement annule
```

L'information apparait :

- dans la topbar sous forme de badge ;
- dans le menu profil avec le detail du plan ;
- avec la date de fin prevue si elle existe.

## Flow date et heure de connexion

Au moment ou Angular cree une session restaurant, il enregistre :

```txt
localStorage.restaurant_login_at = new Date().toISOString()
```

Cette valeur est affichee dans le menu profil :

```txt
Connecte le dd/MM/yyyy HH:mm
```

La date est supprimee a la deconnexion via `AuthService.clearLocalSession()`.

## Flow Assistant Intelligent et chatbot

Le chatbot est une fonctionnalite premium.

Plans autorises :

```txt
Pro
Business
```

Plans non autorises :

```txt
Free Demo
Starter
```

Dans `e-resto-Angular`, l'interface doit verifier les features du restaurant avant d'afficher l'entree Assistant.

Regle d'affichage :

```txt
restaurant.features.chatbot = true
ou plan = Pro / Business
=> afficher le chatbot

sinon
=> masquer le chatbot ou afficher une invitation upgrade
```

Flow cote client :

```txt
Client scanne le QR code
=> e-resto-client charge le menu public
=> le frontend verifie si le plan autorise le chatbot
=> si Pro ou Business, bouton Assistant visible
=> le client pose une question
=> le chatbot utilise les plats, categories, prix et disponibilites
=> le client ajoute au panier puis commande normalement
```

Flow cote dashboard restaurant :

```txt
Restaurant ouvre le dashboard
=> si plan Business, Assistant E-RESTO visible
=> le restaurant pose une question sur ses ventes ou son menu
=> l'assistant lit uniquement les donnees autorisees
=> il propose une analyse ou une action
=> le restaurant confirme manuellement toute action sensible
```

Exemples de questions client :

```txt
Quel plat est populaire ?
Je veux un plat pas trop cher.
Quels plats sont disponibles ?
Comment retrouver ma commande ?
```

Exemples de questions restaurant :

```txt
Quels plats se vendent le mieux ?
Pourquoi mes revenus baissent ?
Comment creer un QR code ?
Quels plats dois-je mettre en avant ?
```

## Flow fidelite client

Le module fidelite permet au restaurant de faire revenir ses clients avec des points, tampons ou coupons.

Flow :

```txt
Client commande via QR code
=> telephone ou email associe a la commande
=> commande servie ou paiement confirme
=> points/tampons ajoutes
=> solde fidelite affiche au client
=> recompense debloquee apres seuil
=> recompense utilisable sur une prochaine commande
```

Regles possibles :

```txt
1 000 CDF = 1 point
1 commande servie = 1 tampon
10 tampons = 1 boisson offerte
50 points = 10% de reduction
```

Flow restaurant :

```txt
Restaurant ouvre Fidelite
=> choisit points, tampons ou coupons
=> definit les seuils
=> active le programme
=> consulte les clients fideles
=> suit les recompenses utilisees
=> lance une campagne
```

## Fichiers concernes

```txt
src/app/layouts/dashboard-layout/dashboard-layout.ts
src/app/layouts/dashboard-layout/dashboard-layout.html
src/app/layouts/dashboard-layout/dashboard-layout.scss
src/app/pages/restaurant-login/restaurant-login.ts
src/app/pages/restaurant-signup/restaurant-signup.ts
src/app/pages/restaurant-checkout/restaurant-checkout.ts
src/app/services/auth/auth-service.ts
```

## Commandes utiles

Installer les dependances :

```bash
npm install
```

Lancer le serveur de developpement :

```bash
npm run start
```

Compiler :

```bash
node node_modules/@angular/cli/bin/ng.js build
```
