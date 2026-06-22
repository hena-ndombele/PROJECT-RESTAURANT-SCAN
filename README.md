# E-RESTO SaaS - Documentation fonctionnelle et technique

## 1. Objectif du projet

E-RESTO est une plateforme SaaS pour restaurants.

Le but est de permettre a un restaurant de :

- creer son compte SaaS ;
- choisir un plan d'abonnement ;
- payer son abonnement ;
- acceder a son espace restaurant ;
- gerer ses plats, categories, tables, agents et commandes ;
- generer des QR codes par table ;
- permettre aux clients de commander sans compte via QR code ;
- encaisser les commandes client en cash au restaurant ;
- envoyer uniquement les commandes hors restaurant vers le WhatsApp du restaurant ;
- suivre les paiements dans le dashboard ;
- produire un recu client.

> Note 2026-06-06 : Mobile Money reste utilise pour payer les abonnements SaaS. Les commandes client dans `e-resto-client` sont en paiement cash uniquement. Les commandes `A emporter` restent envoyees normalement au dashboard du restaurant. Seules les commandes `Hors restaurant`, detectees quand le client n'a pas scanne de table, ouvrent WhatsApp avec un message pret a envoyer au numero configure dans les parametres restaurant.

Le projet est compose de plusieurs applications :

- `e-resto-backend` : API Laravel.
- `e-resto-Angular` : dashboard admin/restaurant.
- `e-resto-client` : application client QR code.
- `e-resto-platform-Angular` : console plateforme interne.

## 2. Flow SaaS restaurant

### 2.1 Inscription restaurant

Le restaurant arrive sur la landing SaaS, choisit un plan, puis cree son compte.

L'inscription est organisee en wizard en deux etapes :

```txt
Etape 1 : informations personnelles
=> email proprietaire
=> mot de passe
=> confirmation du mot de passe
=> bouton afficher/masquer le mot de passe
=> indicateur de force du mot de passe avec 4 barres et libelle dynamique

Etape 2 : informations restaurant
=> nom du restaurant
=> nom du proprietaire
=> telephone
=> ville
=> devise par defaut
```

La devise reste la devise par defaut du restaurant. Les statistiques et rapports continuent de separer les revenus par devise quand des commandes existent en CDF et USD.

Le backend cree :

- un restaurant ;
- un utilisateur proprietaire ;
- une subscription ;
- une session ;
- un email de bienvenue.

Selon le plan :

- plan gratuit : restaurant actif directement ;
- plan payant : restaurant en essai ou en attente de paiement selon le flow.

### 2.1.1 Parametres restaurant et personnalisation client

Dans le back-office Angular, le menu `Parametres` permet au restaurant de modifier :

```txt
=> logo du restaurant
=> nom du restaurant
=> nom du proprietaire
=> telephone
=> adresse et ville
=> devise par defaut
=> slogan affiche dans l'application client
=> couleur principale du menu client
=> couleur de fond du menu client
=> slug public du menu
=> lien Google Maps
=> description courte affichee au client
```

Ces donnees sont sauvegardees dans le profil restaurant Laravel. Quand un client scanne le QR code ou ouvre l'URL publique du restaurant, l'API publique du menu renvoie aussi le branding. L'application client applique automatiquement le logo, le nom, le slogan, la description et les couleurs.

La page `Parametres` respecte le design general du dashboard. Elle reste claire en mode normal et passe en fond sombre uniquement quand le theme sombre du dashboard est active.

La personnalisation du menu client est reservee aux plans Pro et Business. Les restaurants en Free Demo ou Starter peuvent modifier les informations de base du restaurant, mais les champs suivants sont verrouilles :

```txt
=> logo
=> couleurs du menu client
=> slogan
=> description du menu
=> slug public
=> lien Google Maps
```

Le backend applique aussi cette regle. Si un plan non autorise tente de modifier le branding, l'API retourne une erreur 403.

### 2.2 Abonnement

Le paiement d'abonnement utilise les cles MaishaPay globales du SaaS, configurees dans le `.env` backend.

Flow :

```txt
Restaurant choisit un plan
=> checkout Mobile Money
=> backend appelle MaishaPay
=> paiement confirme
=> subscription active
=> restaurant active
=> acces dashboard
```

Important :

- les cles globales du `.env` servent au SaaS ;
- elles ne doivent pas etre exposees dans le frontend ;
- elles ne doivent pas etre documentees en clair.

## 3. Isolation multi-restaurant

Chaque restaurant possede ses propres donnees.

Les entites principales sont liees a `restaurant_id` :

- users ;
- agents ;
- categories ;
- plats ;
- tables ;
- commandes ;
- paiements ;
- Réservations.

Quand un restaurant se connecte, les endpoints authentifies filtrent les donnees par `restaurant_id`.

Objectif :

```txt
Restaurant A ne voit jamais les plats, tables ou commandes du Restaurant B.
```

Le menu public utilise :

```txt
table_id
```

Le backend retrouve la table, puis le restaurant de cette table, puis affiche uniquement les categories et plats de ce restaurant.

## 4. Flow QR code client

### 4.1 Generation du QR code

Dans le dashboard restaurant, le restaurant cree ses tables.

Chaque table possede une URL QR code du type :

```txt
http://IP_DU_FRONTEND_CLIENT:5173/?table_id=UUID_TABLE
```

Quand le client scanne, l'application `e-resto-client` recupere `table_id` dans l'URL.

### 4.2 Chargement du menu

Le client appelle :

```txt
GET /api/public/menu?table_id=UUID_TABLE
```

Le backend :

1. verifie que la table existe ;
2. retrouve son restaurant ;
3. verifie que le restaurant est actif ou en essai ;
4. retourne les categories et plats du restaurant ;
5. ne retourne rien si la table est invalide.

## 5. Creation de commande

Le client ajoute des plats au panier, puis choisit le moyen de paiement.

Les moyens de paiement supportes :

- cash ;
- Mobile Money via MaishaPay : MPESA, Orange Money, Airtel Money.

Quand le client envoie la commande, le backend cree :

- une commande dans `orders` ;
- les lignes de commande dans `order_items` ;
- un paiement dans `payments` ;
- la table passe en statut occupee.

## 6. Separation commande et paiement

Le projet utilise deux statuts differents.

### 6.1 Statut de commande

Champ :

```txt
orders.status
```

Valeurs :

```txt
pending
preparing
ready
delivered
cancelled
```

Signification :

- `pending` : commande recue ;
- `preparing` : en preparation ;
- `ready` : prete ;
- `delivered` : servie ;
- `cancelled` : annulee.

### 6.2 Statut de paiement

Champ :

```txt
orders.payment_status
```

Valeurs :

```txt
unpaid
pending
paid
failed
refunded
```

Signification :

- `unpaid` : pas encore paye ;
- `pending` : paiement Mobile Money en attente ;
- `paid` : paiement confirme ;
- `failed` : paiement echoue ;
- `refunded` : paiement rembourse/comptablement rembourse.

Pourquoi cette separation est importante :

```txt
Une commande peut etre servie mais pas encore payee.
Une commande peut etre en preparation mais deja payee.
Une commande peut etre annulee et remboursee.
```

## 7. Flow paiement cash

Le paiement cash est gere par le restaurant, pas par une API externe.

Flow :

```txt
Client commande
=> payment_method = cash
=> payment_status = unpaid
=> restaurant voit la commande
=> client paie en cash
=> caissier clique "Encaisser cash"
=> payment_status = paid
=> ligne payments mise a jour
=> dashboard comptabilise le revenu
```

Le cash est donc comptabilise dans l'application meme si l'argent est donne physiquement.

Le client peut aussi demander l'addition depuis le suivi de commande quand :

```txt
payment_method = cash
payment_status != paid
status = delivered
```

Le bouton n'apparait donc cote client qu'apres que le restaurant a marque la commande comme servie. Le backend marque ensuite le paiement avec `metadata.bill_requested = true` et diffuse la mise a jour en Temps réel avec les informations fraiches du paiement. Dans le dashboard commandes, une notification modale s'ouvre automatiquement avec son, la table, le client, le numero de commande, les plats et le total. La carte et le modal detail affichent aussi `Addition demandee`.

Donnees utiles :

- montant attendu ;
- montant recu ;
- monnaie rendue ;
- caissier ;
- date d'encaissement.

### 7.1 Modal caisse cash

Dans le dashboard, le bouton `Cash` n'encaisse plus directement.

Flow caisse :

```txt
Restaurant clique Cash
=> modal caisse s'ouvre
=> total a payer affiche
=> caissier entre le montant recu
=> application calcule la monnaie a rendre
=> si montant recu < total, confirmation bloquee
=> caissier confirme
=> payment_status = paid
=> payment metadata stocke received_amount et change_amount
=> recu cash imprimable s'ouvre
=> statistiques mises a jour
```

Le recu cash contient :

- table ;
- numero de commande ;
- articles ;
- quantites ;
- prix ;
- total ;
- montant recu ;
- monnaie rendue ;
- moyen de paiement cash.

## 8. Flow paiement Mobile Money

Quand le client choisit Mobile Money, le paiement est lance immediatement au moment de la commande.

Flow :

```txt
Client choisit ses plats
=> choisit MPESA / Orange Money / Airtel Money
=> saisit son numero wallet
=> clique "Commander et payer"
=> backend cree la commande
=> payment_status = pending
=> backend cree une ligne payment
=> backend appelle MaishaPay
=> MaishaPay envoie la demande au telephone du client
=> client valide sur son telephone
=> MaishaPay confirme ou echoue
=> backend met payment_status = paid ou failed
```

La commande existe meme si le paiement est encore en attente.

Exemple :

```txt
status = pending
payment_status = pending
payment_method = mobile_money
payment_provider = MPESA
```

Apres confirmation :

```txt
status = pending ou preparing
payment_status = paid
```

## 9. Ou va l'argent Mobile Money ?

L'application ne recoit pas directement l'argent.

Avec un gateway comme MaishaPay :

```txt
Wallet client
=> operateur Mobile Money
=> MaishaPay / compte marchand configure
=> settlement vers compte bancaire ou wallet marchand selon contrat
```

L'argent va vers le compte marchand associe aux cles MaishaPay utilisees.

### 9.1 Situation actuelle

Actuellement, les commandes Mobile Money utilisent la configuration MaishaPay globale du backend.

Donc :

```txt
Paiements clients
=> compte marchand associe aux cles du backend
```

### 9.2 Recommandation SaaS professionnelle

Pour un SaaS multi-restaurant, le meilleur modele est :

```txt
Abonnement SaaS
=> cles MaishaPay du SaaS
=> argent vers le proprietaire de la plateforme

Commandes clients
=> cles MaishaPay du restaurant
=> argent vers le restaurant
```

Pour cela, il faut ajouter une configuration par restaurant.

Table recommandee :

```txt
restaurant_payment_settings
- id
- restaurant_id
- provider
- gateway_mode
- public_api_key
- secret_api_key chiffree
- default_mobile_provider
- callback_url
- is_active
- created_at
- updated_at
```

La cle secrete doit etre chiffree et jamais affichee en clair apres enregistrement.

## 10. Annulation de commande

Le projet applique maintenant des regles d'annulation.

### 10.1 Cote client QR

Le client peut annuler seulement si :

```txt
status = pending
payment_status != paid
```

Donc le client peut annuler avant que le restaurant commence la preparation.

Le client doit donner une raison d'annulation.

### 10.2 Cote restaurant

Le restaurant peut annuler une commande non servie avec une raison obligatoire.

Regles :

```txt
pending   => annulation autorisee
preparing => annulation restaurant autorisee avec raison
ready     => annulation restaurant autorisee avec raison
delivered => annulation bloquee
```

Si la commande est deja servie, on ne l'annule plus. On gere plutot un remboursement.

### 10.3 Effet sur paiement

Si commande annulee avec paiement en attente :

```txt
payment_status = failed
```

Si commande annulee avec paiement deja confirme :

```txt
payment_status = refunded
```

Si commande annulee avant paiement cash :

```txt
payment_status = unpaid
```

### 10.4 Audit d'annulation

Les champs ajoutes :

```txt
cancellation_reason
cancelled_by
cancelled_at
```

Ils permettent de savoir :

- pourquoi la commande a ete annulee ;
- qui l'a annulee ;
- quand elle a ete annulee.

## 11. Dashboard restaurant Angular

Le dashboard Angular a ete rendu reactif et connecte aux donnees reelles.

Il affiche :

- commandes du jour ;
- chiffre du jour ;
- plats disponibles ;
- occupation des tables ;
- revenu du mois ;
- revenu de l'annee ;
- equipe ;
- performance 7 jours ;
- etat du service ;
- commandes recentes ;
- top plats du mois.

Le dashboard se rafraichit automatiquement.

Important :

Apres le premier chargement, l'actualisation ne vide plus l'ecran. Les anciennes donnees restent visibles pendant le refresh.

## 12. Gestion des commandes dans Angular

La liste des commandes affiche deux colonnes distinctes :

- `Commande` : statut cuisine/service ;
- `Paiement` : statut de paiement.

Le restaurant peut :

- passer une commande en preparation ;
- la marquer prete ;
- la marquer servie ;
- l'annuler avec raison ;
- encaisser le cash.

Le bouton `Encaisser cash` :

```txt
payment_method = cash
payment_status = paid
```

La commande n'est pas forcement terminee pour autant. Le statut commande reste separe.

## 13. Recu client

Le recu client s'affiche quand :

```txt
payment_status = paid
```

Il contient :

- numero de recu ;
- table ;
- date ;
- heure ;
- moyen de paiement ;
- articles ;
- quantites ;
- prix ;
- total paye ;
- note client si disponible.

Le moyen de paiement est affiche dans :

- le recu visible dans le navigateur ;
- le PDF ;
- le texte partage.

Exemples :

```txt
Paiement : Cash
Paiement : MPESA
Paiement : ORANGE_MONEY
```

## 14. Emails

Quand un restaurant cree son compte SaaS, un email de bienvenue est envoye.

Cet email est non bloquant : si Gmail, le SMTP ou le cache Blade rencontre une erreur, le compte du restaurant reste cree et l'erreur est journalisee cote backend.

L'envoi utilise la configuration SMTP du backend.

Les informations sensibles SMTP ne doivent pas etre documentees en clair.

## 15. Securite et bonnes pratiques

Ne jamais exposer dans le frontend :

- secret API MaishaPay ;
- mot de passe SMTP ;
- tokens serveur ;
- cles privees.

Les cles sensibles doivent rester :

```txt
backend .env
ou base de donnees chiffree
```

Pour les restaurants, les cles MaishaPay doivent etre chiffrees en base.

## 16. Endpoints importants

### SaaS

```txt
GET  /api/saas/plans
POST /api/saas/signup
POST /api/saas/checkout/mobile-money
POST /api/saas/login
GET  /api/saas/restaurant/dashboard
GET  /api/saas/restaurant/usage
```

### Menu public

```txt
GET /api/public/menu?table_id=UUID_TABLE
```

### Commandes

```txt
POST  /api/orders
GET   /api/orders/{id}
PATCH /api/orders/{id}/cancel
GET   /api/orders
PATCH /api/orders/{id}/status
PATCH /api/orders/{id}/payment
POST  /api/orders/payment-callback
```

## 17. Tests effectues

Les verifications suivantes ont ete executees pendant les modifications :

```txt
php artisan migrate
php artisan route:list --path=orders
npm.cmd run build dans e-resto-Angular
npm.cmd run build dans e-resto-client
```

Les builds passent.

Les warnings restants concernent surtout la taille des bundles frontend et ne bloquent pas l'application.

## 18. Prochaines ameliorations recommandees

Pour rendre le SaaS encore plus professionnel :

- ajouter les parametres MaishaPay par restaurant ;
- chiffrer les cles secretes restaurant ;
- ajouter une page `Parametres > Paiements` ;
- ajouter fermeture de caisse ;
- ajouter rapports cash / Mobile Money ;
- ajouter roles manager pour annulation apres preparation ;
- ajouter remboursement reel Mobile Money via API si MaishaPay le supporte ;
- ajouter historique/audit complet des actions ;
- ajouter notifications email/SMS au restaurant.

## 19. Temps réel dashboard Angular

Le dashboard Angular utilise maintenant un websocket Reverb pour les commandes.

Objectif :

```txt
Nouvelle commande client
=> evenement Laravel broadcast
=> Angular recoit l'evenement sans actualiser la page
=> compteur commandes mis a jour
=> notification header
=> son de notification
=> liste commandes mise a jour
```

### 19.1 Backend Reverb

Le backend utilise Laravel Reverb.

Configuration active dans `.env` :

```txt
BROADCAST_CONNECTION=reverb
REVERB_APP_KEY=e-resto-key
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080
```

Commande de demarrage du serveur websocket :

```txt
cd e-resto-backend
php artisan reverb:start --host=0.0.0.0 --port=8080
```

Important : pour que le Temps réel fonctionne, il faut lancer :

```txt
serveur Laravel API
serveur Reverb
serveur Angular dashboard
serveur React client QR
```

### 19.2 Channels commandes

Les evenements commandes sont diffuses sur :

```txt
orders
orders.{restaurant_id}
orders.{order_id}
```

Angular ecoute en priorite :

```txt
orders.{restaurant_id}
```

Cela evite qu'un restaurant recoive les notifications d'un autre restaurant.

### 19.3 Notifications dashboard

Dans `e-resto-Angular`, le service `OrderRealtimeService` gere :

- connexion websocket ;
- reconnexion automatique ;
- chargement initial des commandes ;
- reception des nouvelles commandes ;
- mise a jour des commandes existantes ;
- compteur des commandes non servies ;
- notifications dans le header ;
- son de notification.

Une commande est compte comme active/non servie si :

```txt
status != delivered
status != cancelled
```

### 19.4 Sidebar et header

Le badge `Orders` dans la sidebar affiche maintenant le nombre reel de commandes non servies.

Le header affiche :

- une cloche de notification ;
- le nombre de nouvelles commandes ;
- une liste des messages entrants ;
- l'etat websocket `Live` ou `Offline`.

### 19.5 Dashboard sans polling

Le dashboard garde un chargement initial API, puis les donnees commandes sont mises a jour via websocket.

Les cartes et graphiques changent quand un evenement commande arrive, sans refresh complet.

### 19.6 Theme clair/sombre

Le dashboard Angular possede maintenant un bouton theme dans le header.

Le theme est sauvegarde dans :

```txt
localStorage.dashboard_theme
```

Valeurs :

```txt
light
dark
```

Le choix reste actif apres rechargement de la page.

### 19.7 Tables en mode sombre

Le theme sombre applique aussi les variables Bootstrap des tableaux.

Elements couverts :

- lignes de tableau ;
- cellules ;
- en-tetes ;
- pieds ;
- hover ;
- bordures ;
- pagination ;
- badges clairs.

Objectif :

```txt
Quand le theme dark est actif, les tableaux ne restent plus en fond blanc.
```

## 20. Modification de commande par le client

Le client peut modifier sa commande uniquement avant le debut de la preparation.

Regle appliquee :

```txt
Modification autorisee si :
status = pending
payment_status != paid
```

Modification bloquee si :

```txt
status = preparing
status = ready
status = delivered
status = cancelled
payment_status = paid
```

### 20.1 Flow client

Dans le suivi de commande, le bouton `Modifier ma commande` apparait seulement si la commande est encore modifiable.

Flow :

```txt
Client commande
=> commande en status pending
=> client clique Modifier ma commande
=> les articles existants reviennent dans le panier
=> client ajoute/retire/modifie les quantites
=> client valide
=> backend remplace les order_items
=> backend recalcule total_amount
=> dashboard restaurant recoit la mise a jour en Temps réel
```

### 20.2 Paiement cash

Si la commande est en cash :

```txt
payment_method = cash
payment_status = unpaid
```

Quand le client modifie la commande :

```txt
total_amount est recalcule
payment reste unpaid
le restaurant encaisse le nouveau total
```

### 20.3 Paiement Mobile Money

Si la commande est Mobile Money et que le paiement n'est pas confirme :

```txt
ancien paiement pending => failed
nouvelle ligne payment creee
MaishaPay est relance avec le nouveau montant
payment_status devient pending / paid / failed selon la reponse
```

Si le paiement est deja confirme :

```txt
payment_status = paid
=> modification bloquee
```

### 20.4 Endpoint

Endpoint public utilise par le client QR :

```txt
PATCH /api/orders/{id}/items
```

Payload :

```json
{
  "note": "Sans piment",
  "wallet_id": "+243...",
  "items": [
    { "plat_id": "uuid", "quantity": 2 }
  ]
}
```

Le backend verifie toujours que :

- la commande existe ;
- la commande est encore `pending` ;
- le paiement n'est pas deja `paid` ;
- les plats appartiennent au meme restaurant ;
- les plats sont disponibles.

### 20.5 Protection contre doublons

La modification de commande est protegee contre les doublons.

Cote client :

```txt
un verrou local bloque le double clic pendant l'envoi
```

Cote backend :

```txt
la commande est verrouillee avec lockForUpdate pendant la modification
les articles recus sont regroupes par plat_id
les anciennes lignes sont supprimees
les nouvelles lignes remplacent l'ancien contenu
```

Cela evite qu'une modification rapide soit enregistree deux fois.

### 20.6 Suivi client apres modification

Le suivi client detecte maintenant aussi :

- changement de total ;
- changement de note ;
- changement d'articles ;
- changement de quantite ;
- changement de statut paiement ;
- changement de statut commande.

Avant, le suivi detectait surtout le changement de statut. Maintenant, une modification de commande sans changement de statut est aussi prise en compte.

### 20.7 Notifications client avec son

Dans l'application client QR, le suivi de commande notifie le client quand le statut change.

Depuis cette mise a jour, si le statut devient `cancelled`, le client recoit aussi :

```txt
=> son de notification
=> toast
=> modal automatique
=> details de la commande
=> motif d'annulation
```

Quand le client modifie une commande encore en `pending`, il peut fermer le panier, ajouter d'autres plats depuis le menu, puis rouvrir le panier pour enregistrer la modification.

Le client recoit :

- une notification visuelle dans l'application ;
- une notification navigateur si l'autorisation est accordee ;
- un son court de notification.
- une banniere persistante dans le suivi de commande quand le statut change.

Au premier clic/toucher/clavier dans l'application, le client QR prepare :

```txt
permission Notification navigateur
deverrouillage audio navigateur
```

Cela permet au son de fonctionner aussi quand l'onglet reste ouvert en arriere-plan, selon les limites du navigateur et du telephone.

Dans le suivi de commande, un bouton est aussi affiche :

```txt
Activer les alertes
```

Quand le client appuie dessus :

```txt
le navigateur demande/prepare les notifications
le son est deverrouille
un son de test est joue
les prochains changements de statut declenchent le son
```

Quand le statut change apres une reprise de commande, le client voit aussi :

```txt
Mise a jour visible dans le bloc Suivi de commande
scroll automatique vers le suivi
toast en bas de page
son de notification
notification navigateur si autorisee
```

Limite importante :

```txt
Si l'application est completement fermee,
un navigateur ne permet pas de jouer librement un son JavaScript.
```

Pour recevoir une notification quand l'application est fermee, il faut ajouter un vrai systeme Web Push/PWA :

```txt
Service Worker
Push subscription
backend qui stocke les subscriptions
backend qui envoie le push lors du changement de statut
notification systeme affichee par le telephone
```

Le son dans ce cas depend souvent du systeme d'exploitation et du navigateur, pas directement du code de l'application.

### 20.8 Reprise du suivi apres fermeture accidentelle

Si le client quitte l'application par erreur puis rescane le QR code avec le meme telephone et le meme navigateur, l'application tente de restaurer automatiquement la commande en cours.

Le client QR garde :

```txt
dernier order_id actif
dernier status connu
association table_id => order_id actif
```

Apres creation ou modification de commande, l'URL du client est aussi enrichie :

```txt
/?table_id=UUID_TABLE&order_id=UUID_COMMANDE
```

Au prochain chargement, l'application cherche dans cet ordre :

```txt
1. order_id present dans l'URL
2. order_id memorise pour cette table
3. dernier order_id actif global
```

Ensuite elle appelle :

```txt
GET /api/orders/{order_id}
```

Si la commande existe encore, le suivi se reactive et affiche le statut actuel.

Limite :

```txt
Si le client change de telephone, change de navigateur,
ou efface les donnees du navigateur, l'application ne peut pas deviner sa commande.
```

Pour ce cas, il faudra ajouter plus tard une recherche de commande par code court, numero de telephone ou lien envoye par SMS/WhatsApp.

### 20.9 Reprise par code court, telephone et lien partageable

Le backend genere maintenant un code court unique sur chaque commande.

Exemple :

```txt
tracking_code = A7K92B
```

Le client QR affiche ce code dans le suivi de commande.

Le client peut :

- garder le code ;
- partager le lien de suivi via le partage natif du telephone, par exemple WhatsApp ;
- revenir plus tard et entrer son code ou son numero de telephone.

Apres creation ou modification, l'URL contient :

```txt
/?table_id=UUID_TABLE&order_id=UUID_COMMANDE&tracking_code=A7K92B
```

Endpoint public de reprise :

```txt
GET /api/orders/track?code=A7K92B
GET /api/orders/track?phone=+243...
GET /api/orders/track?code=A7K92B&table_id=UUID_TABLE
```

Flow principal recommande et securise :

```txt
Client ferme l'application
=> rescane le QR code avec le meme telephone/navigateur
=> l'application retrouve order_id dans localStorage
=> elle recharge la commande exacte
=> suivi Temps réel se reactive
=> le client voit le statut actuel
=> les prochains changements declenchent son + toast + banniere de suivi
```

Important :

```txt
Le QR de table seul ne restaure plus une commande existante.
```

Pourquoi :

```txt
Si une autre personne scanne le meme QR avec un autre telephone,
elle ne doit pas voir la commande du premier client.
```

Le code court et le telephone servent de secours :

```txt
client change de telephone
client change de navigateur
donnees localStorage effacees
besoin de retrouver une commande sans contexte fiable
plusieurs commandes actives existent sur la meme table
```

Dans ces cas, le client scanne le QR puis entre son code de suivi ou son telephone dans `Retrouver ma commande`.

Les commandes annulees ou deja servies ne sont pas restaurees par cet endpoint.

### 20.9.1 Plusieurs commandes sur la meme table

Si plusieurs clients commandent chacun avec son telephone sur la meme table, il peut y avoir plusieurs commandes actives avec le meme `table_id`.

Dans ce cas, et meme s'il n'y a qu'une seule commande active, le backend ne restaure plus une commande avec `table_id` seul.

Flow :

```txt
Client scanne le QR de la table avec un autre telephone
=> l'application affiche le menu
=> elle affiche aussi Retrouver ma commande
=> le client doit entrer son code de suivi ou son telephone
=> sa commande exacte est restauree
```

Message :

```txt
Pour proteger les clients, le QR de table seul ne restaure pas une commande existante.
Entrez le code de suivi ou le numero de telephone.
```

Correction importante :

```txt
La reprise automatique par QR seul est desactivee pour eviter d'afficher
la commande d'un autre client sur la meme table.
```

### 20.10 Statuts sans retour en arriere

Le restaurant ne peut plus faire revenir une commande a un statut precedent.

Ordre autorise :

```txt
pending
=> preparing
=> ready
=> delivered
```

Exemples bloques :

```txt
preparing => pending
ready => preparing
delivered => ready
delivered => preparing
delivered => pending
```

Quand une commande est `delivered`, elle ne peut plus revenir en arriere.

## 21. Limites des forfaits et actions bloquees

Chaque Plan possede des quotas.

Exemple actuel :

```txt
Free Demo
=> 3 tables
=> 1 utilisateur
```

Le backend expose maintenant l'utilisation du forfait du restaurant connecte :

```txt
GET /api/saas/restaurant/usage
```

La reponse contient :

- le plan actif ;
- les limites du plan ;
- l'utilisation actuelle ;
- les permissions comme `can_create_table` et `can_create_user` ;
- les messages a afficher dans l'interface.

### 21.1 Tables

Dans le dashboard Angular, l'ecran Tables affiche :

```txt
Plan Free Demo : 3 / 3 tables
```

Quand la limite est atteinte :

```txt
Create Table => bouton grise/desactive
```

Le modal ne s'ouvre plus et l'utilisateur voit pourquoi l'action est bloquee.

Le backend garde aussi la protection :

```txt
POST /api/tables
=> 422 Limite de tables atteinte pour le plan ...
```

Cela evite qu'un utilisateur contourne l'interface depuis Postman ou un autre client.

### 21.2 Utilisateurs

La creation d'employes est aussi protegee par le quota `max_users` du plan.

Si le restaurant a deja atteint sa limite :

```txt
POST /api/auth/register
=> 422 Limite d'utilisateurs atteinte pour le plan ...
```

Objectif professionnel :

```txt
Ce qui n'est plus autorise par le forfait doit etre visible mais desactive/grise,
et le backend doit toujours refuser l'action si la limite est depassee.
```

## 22. Commandes dashboard, rapports PDF et devises

La page commandes du dashboard Angular utilise maintenant une disposition en cartes.

Objectif :

```txt
Nouvelle commande
=> son de notification
=> modal Nouvelle commande
=> bouton Voir la commande
=> detail complet dans un modal
```

Chaque commande affiche :

- table ;
- total ;
- devise ;
- statut commande ;
- statut paiement ;
- heure ;

Le nom client, le nombre d'articles et la note cuisine ne sont plus affiches dans la card pour garder la liste lisible. Ils sont visibles dans le modal detail.

Un bouton avec icone oeil permet d'ouvrir le detail complet :

```txt
client
telephone
email
code de suivi
articles
quantites
prix
total
paiement
statut
note
```

Le numero/nom de la table est affiche en gras dans chaque card pour etre le premier repere visuel.

Le bouton oeil est fonce pour etre visible et ouvrir rapidement les informations completes.

Le modal detail garde le meme design professionnel que le reste de la page :

```txt
en-tete commande/table
badges statut commande et paiement
infos client
articles commandes
note cuisine
total
```

Le mode sombre couvre aussi la page commandes : cards, filtres, onglets, pagination, modals, encaissement cash et detail commande.

### 22.1 Filtrage commandes

La page commandes permet de filtrer par :

- jour ;
- mois ;
- annee ;
- statut commande ;
- recherche rapide.

Le filtre statut est aussi disponible sous forme d'onglets avec compteurs :

```txt
Toutes
Nouvelles
En preparation
Pretes
Servies
Annulees
```

Chaque onglet liste uniquement les commandes de son statut.

La liste affiche une pagination en bas des cards des qu'il y a des commandes, avec page courante, nombre total de pages et nombre de commandes filtrees.

### 22.1.1 Modal nouvelle commande

Quand une nouvelle commande arrive :

```txt
son de notification
modal Nouvelle commande
client
table
nombre d'articles
total
plats commandes
bouton Voir la commande
```

Le bouton `Voir la commande` ouvre le modal detail complet.

### 22.2 Statuts sans retour arriere dans le dashboard

Le select de statut bloque les retours en arriere.

Ordre autorise :

```txt
pending => preparing => ready => delivered
```

Une commande `delivered` ne peut plus revenir a un statut precedent.

### 22.3 Rapports PDF selon le plan

La generation de rapport PDF est disponible uniquement pour les plans qui ont le reporting avance.

Plans autorises :

```txt
Pro
Enterprise
ou plan dont les features contiennent Rapport/Report
```

Si le plan ne donne pas droit au PDF, le bouton est grise avec un message.

Le rapport contient :

- commandes filtrees ;
- table ;
- statut ;
- paiement ;
- nombre d'articles ;
- total ;
- date ;
- revenus payes groupes par devise.

La generation utilise l'impression navigateur afin de sauvegarder en PDF.

### 22.4 Statistiques par devise

Le dashboard ne melange plus les revenus CDF et USD dans un seul montant.

Les revenus sont affiches par devise :

```txt
Revenu CDF
Revenu USD
```

Les cartes du dashboard affichent les revenus journaliers, mensuels et annuels separes par devise.

## 23. Commande a emporter et feedback client

Le client qui scanne une table peut choisir le mode de service avant d'envoyer son panier :

```txt
Sur place
A emporter
```

Si le client choisit `A emporter`, la commande reste liee a la table scannee pour le suivi et le restaurant voit le badge `A emporter` dans la liste des commandes, le modal nouvelle commande, le modal detail et le modal addition. Le telephone du client est demande pour que le restaurant puisse identifier la commande a recuperer.

Flow :

```txt
client scanne le QR code
client ajoute des plats
client choisit Sur place ou A emporter
client envoie la commande
dashboard recoit la commande en Temps réel avec son + modal
restaurant prepare
restaurant passe les statuts jusqu'a Servie
client recoit le suivi et peut donner son avis
```

Pour une commande sur place, apres le statut `Servie`, l'application client affiche automatiquement un modal de feedback.

Pour une commande `A emporter`, le feedback peut s'afficher des que la commande passe a `Prete`, car le client vient recuperer sa commande et peut evaluer l'experience de commande/retrait.

```txt
Qualite des plats : 1 a 5 etoiles
Rapidite du service : 1 a 5 etoiles
Facilite de commande : 1 a 5 etoiles
Recommanderiez-vous ce restaurant ? Oui / Non
Commentaire optionnel
```

Le feedback est accepte uniquement si la commande est `delivered`, ou si elle est `ready` avec `order_type = takeaway`. Une meme commande ne cree pas plusieurs avis : si le client renvoie l'avis, il met a jour l'avis existant.

Le module Feedback est reserve aux plans Pro, Business et Enterprise. Si le restaurant est sur Free Demo ou Starter :

```txt
le backend refuse POST /api/public/feedbacks
le dashboard /feedback/list affiche un message d'upgrade
le client ne declenche pas le modal feedback
```

Dans e-resto-Angular, le menu `Feedbacks` affiche le nombre d'avis, la note moyenne, le taux de recommandation, les filtres, la table, la reference commande, les notes et le commentaire.

## 24. Réservations professionnelles

Le module reservation suit un flow SaaS professionnel :

```txt
client ouvre le menu QR ou le menu public
client remplit nom, telephone, email, nombre de personnes, date, heure et demande speciale
backend cree une reservation en statut pending
dashboard restaurant affiche la demande dans Réservations
restaurant confirme ou annule
si confirme, la table liee passe Reservee
quand le client arrive, restaurant passe la reservation en seated
la table passe Occupee
en fin de service, restaurant passe completed
la table redevient Disponible
```

Statuts disponibles :

```txt
pending     : demande recue, pas encore confirmee
confirmed   : reservation acceptee, table bloquee
seated      : client installe
completed   : reservation terminee
cancelled   : reservation annulee avec motif
no_show     : client non venu
```

Dans e-resto-client, le client voit clairement que sa demande est envoyee au restaurant et qu'elle doit etre confirmee. Une reference courte est affichee apres envoi.

Dans e-resto-Angular, le restaurant peut :

- filtrer par date ;
- filtrer par statut ;
- rechercher par client, telephone, email ou table ;
- voir les details dans un modal ;
- ajouter une note interne ;
- confirmer, installer, terminer, annuler ou marquer no-show ;
- supprimer une reservation si necessaire.

La reservation est rattachee au restaurant via la table scannee ou via le `restaurant_slug` du menu public.

Pour un client a la maison, il faut partager le lien public du restaurant :

```txt
https://votre-domaine-client/?restaurant_slug=slug-du-restaurant
```

Le client n'a pas besoin de scanner une table. Il ouvre le lien, va dans Reservation, remplit le formulaire et le restaurant voit la demande dans e-resto-Angular.

Sans `table_id` et sans `restaurant_slug`, l'application client ne peut pas savoir a quel restaurant envoyer la reservation, donc le bouton est bloque.

## 25. Support client dans un vrai SaaS

Le support client doit etre gere en deux niveaux.

Support du restaurant vers E-RESTO :

```txt
restaurant ouvre Support
restaurant cree un ticket : technique, paiement, abonnement, bug, configuration
E-RESTO voit le ticket dans la plateforme admin
statuts : open, in_progress, waiting_customer, resolved, closed
priorites selon plan : standard, prioritaire, SLA business
```

Support du client final vers le restaurant :

```txt
client final a un souci sur commande/reservation
client utilise Contact ou appelle le restaurant
restaurant gere la reponse directement
si le probleme est technique, restaurant escalade vers E-RESTO
```

Recommandation SaaS :

- Free/Starter : support email ou communautaire ;
- Pro : support standard avec suivi ticket ;
- Business/Enterprise : support prioritaire, onboarding et SLA ;
- chaque ticket doit contenir restaurant, utilisateur, categorie, priorite, message, pieces jointes, statut et historique.

## 26. Chargement immediat des plans Pricing

La page Pricing charge maintenant les plans via l'endpoint leger :

```txt
GET /api/saas/plans
```

L'endpoint complet `/api/saas/overview` reste charge en arriere-plan pour les metriques et informations globales.

Cela evite une page Pricing vide au clic, car les cartes de plans n'attendent plus le calcul des statistiques SaaS.

La page Pricing affiche aussi des plans de secours instantanes. Des que le backend repond, les plans reels remplacent ces donnees sans afficher de spinner ni donner l'impression que la page actualise.

La landing SaaS garde les couleurs E-RESTO et reprend une disposition premium de menu digital QR : hero photo plein ecran, CTA, statistiques rapides, fonctionnalites, section scan QR complete en fond noir avec image generee, logo E-RESTO au centre du QR code et texte overlay, puis etapes operationnelles.

La section finale `Pret a moderniser votre restaurant ?` affiche trois statistiques marketing fixes avec prefixe `+` : +20 restaurants inscrits, +800 Commandes traitées et +60 QR codes générés. Les valeurs ont un effet count-up rapide quand la section devient visible.

Cette section utilise un background image premium `assets/landing/cta-chef-bg.png` avec un chef et un overlay sombre pour garder les statistiques et le CTA lisibles.

La landing contient aussi une section `Tout ce que vous devez savoir Pour démarrer avec E-RESTO` sans bloc video demo. Elle explique le demarrage en trois etapes : creation de l'espace restaurant, configuration du menu/tables/QR codes et reception des commandes.

Un footer SaaS professionnel est ajoute avec adresse, contact, liens produit/ressources et formulaire newsletter.

Les boutons principaux de `e-resto-angular` sont forces a un rayon de 8px afin d'eviter les formes trop rondes dans l'application.

Le budget Angular `anyComponentStyle` est augmente a 14kB en warning et 18kB en erreur pour accepter la landing SaaS complete sans casser le build.

## 27. Flow Newsletter SaaS

La newsletter de la landing `e-resto-angular` fonctionne avec le backend Laravel.

Endpoint :

```txt
POST /api/saas/newsletter
```

Payload :

```json
{
  "email": "client@example.com",
  "source": "saas_landing"
}
```

Flow :

1. Le visiteur entre son email dans le footer SaaS.
2. Angular valide que le champ n'est pas vide et appelle `/api/saas/newsletter`.
3. Laravel valide le format email.
4. Si l'email n'existe pas, il cree une ligne dans `newsletter_subscribers`.
5. Si l'email existe deja, il reactive l'abonnement sans creer de doublon.
6. Le frontend affiche le message de confirmation.

Les informations conservees sont : email, source, statut, date d'inscription, adresse IP et user-agent.

La landing ajoute un feedback visuel sur le formulaire newsletter : message de succes ou d'erreur, bouton desactive pendant l'envoi, et aucun doublon en base grace a `updateOrCreate`.

Le footer affiche aussi la mention legale : `© 2026 E-RESTO. Tous droits reserves.`

Des animations professionnelles sont appliquees a la landing : apparition progressive des sections au scroll, hover subtil sur les cards, boutons et statistiques, avec respect de `prefers-reduced-motion`.

## 28. Flow apres creation du compte restaurant

Apres `POST /api/saas/signup`, `e-resto-angular` ne redirige plus immediatement vers le dashboard.

Flow :

1. Le restaurant cree son compte.
2. Le backend retourne le restaurant cree avec son `slug`.
3. Angular stocke la session et construit l'URL publique du menu :

```txt
http://localhost:5173/?restaurant_slug=slug-du-restaurant
```

4. L'utilisateur voit une carte `Compte cree !` avec :
- l'URL publique du menu ;
- un bouton copier ;
- un bouton ouvrir le menu ;
- un bouton acceder au dashboard.

Cela permet au restaurant de voir directement le lien client qu'il pourra partager ou utiliser pour ses QR codes.

## 29. Authentification restaurant uniquement

Dans `e-resto-angular`, l'ancien flux `/auth/login` + `/auth/otp` n'est plus utilise pour les restaurants.

Routes :

```txt
/auth/login -> redirige vers /restaurant/login
/auth/otp   -> redirige vers /restaurant/login
```

Le login principal reste donc le login SaaS restaurant :

```txt
/restaurant/login
```

Si un utilisateur se deconnecte depuis le dashboard ou si une session expire, il revient toujours sur `/restaurant/login`.

## 30. Flow affichage abonnement et connexion dans l'administration

Dans l'administration `e-resto-angular`, le layout du dashboard affiche maintenant les informations de session SaaS du restaurant connecte.

Objectif :

```txt
Restaurant connecte
=> lecture de restaurant_session
=> calcul des jours restants selon le statut
=> affichage dans la topbar et le menu profil
=> affichage de la date et heure de connexion
```

### 30.1 Jours restants d'abonnement

Angular lit les champs du restaurant stocke en session :

```txt
restaurant.status
restaurant.trial_ends_at
restaurant.subscription_ends_at
restaurant.subscription.status
restaurant.subscription.ends_at
restaurant.subscription.current_period_end
restaurant.plan.name
```

Regles d'affichage :

```txt
status = trial
=> affiche les jours restants d'essai

status = active
=> affiche les jours restants d'abonnement paye

status = pending_payment
=> affiche Paiement en attente

status = past_due ou expired
=> affiche Abonnement expire

status = suspended ou cancelled
=> affiche Abonnement suspendu/annule
```

Le calcul utilise la difference entre la date de fin et la date actuelle :

```txt
jours_restants = ceil((date_fin - maintenant) / 1 jour)
minimum = 0
```

L'information est visible :

- dans la topbar, avec un badge compact ;
- dans le menu profil, avec le detail du plan et la date de fin prevue.

### 30.2 Date et heure de connexion

Quand une session restaurant est creee, Angular enregistre :

```txt
localStorage.restaurant_login_at = date ISO actuelle
```

Cette date est enregistree dans les flows suivants :

```txt
/restaurant/login
creation de compte restaurant
checkout Mobile Money apres activation de session
```

Le menu profil affiche ensuite :

```txt
Connecte le dd/MM/yyyy HH:mm
```

A la deconnexion, `restaurant_login_at` est supprime avec le token et la session restaurant.

Fichiers concernes :

```txt
e-resto-Angular/src/app/layouts/dashboard-layout/dashboard-layout.ts
e-resto-Angular/src/app/layouts/dashboard-layout/dashboard-layout.html
e-resto-Angular/src/app/layouts/dashboard-layout/dashboard-layout.scss
e-resto-Angular/src/app/pages/restaurant-login/restaurant-login.ts
e-resto-Angular/src/app/pages/restaurant-signup/restaurant-signup.ts
e-resto-Angular/src/app/pages/restaurant-checkout/restaurant-checkout.ts
e-resto-Angular/src/app/services/auth/auth-service.ts
```

## 31. Formulaire Contact Restaurant

La landing `e-resto-angular` contient un formulaire de contact sous la section `Pret a moderniser votre restaurant ?`.

Endpoint :

```txt
POST /api/public/contact
```

Payload :

```json
{
  "name": "Nom du restaurant ou proprietaire",
  "email": "client@example.com",
  "phone": "+243...",
  "subject": "Demande restaurant SaaS",
  "message": "Message du restaurant"
}
```

Flow :

1. Le restaurant remplit le formulaire de contact sur la landing.
2. Angular valide les champs obligatoires : nom, email et message.
3. Laravel enregistre le message dans `contact_messages`.
4. Laravel tente d'envoyer le message par email a l'adresse configuree dans le backend apres l'enregistrement.
5. Le SMTP utilise un timeout court via `MAIL_TIMEOUT=5` pour eviter que le formulaire reste bloque trop longtemps.
6. Si l'envoi mail echoue, le message reste en base et l'erreur est journalisee sans bloquer l'utilisateur.
7. Angular affiche un message de succes ou d'erreur.

Correction UX appliquee :

- les boutons contact et newsletter utilisent un timeout frontend et s'arretent toujours apres succes ou erreur ;
- les erreurs de validation Laravel sont affichees clairement dans la landing ;
- la creation de compte restaurant envoie maintenant l'email de bienvenue apres la reponse HTTP pour ne pas bloquer l'inscription ;
- les boutons de creation de compte et de connexion s'arretent aussi en cas d'erreur ou de timeout.

## 32. Assistant Intelligent, chatbot et fidelite client

E-RESTO peut evoluer vers une plateforme SaaS plus professionnelle avec deux modules de croissance :

```txt
Assistant Intelligent E-RESTO
Programme de fidelite client
```

L'objectif n'est pas seulement de digitaliser le menu, mais aussi d'aider le restaurant a vendre plus, conseiller ses clients et les faire revenir.

### 32.1 Disponibilite selon les plans

Le chatbot est reserve uniquement aux plans :

```txt
Pro
Business
```

Les plans Free Demo et Starter ne doivent pas afficher le chatbot dans le menu client ni dans le dashboard restaurant.

Regle produit :

```txt
Plan Free Demo / Starter
=> pas de chatbot
=> message upgrade si le restaurant tente d'activer l'assistant

Plan Pro
=> chatbot client
=> recommandations de plats
=> aide au client final

Plan Business
=> chatbot client
=> assistant dashboard restaurant
=> recommandations avancees et aide a la decision
```

### 32.2 Flow chatbot cote client

Le chatbot cote client apparait dans `e-resto-client`, sur le menu QR du restaurant, uniquement si le restaurant est sur un plan Pro ou Business.

Flow :

```txt
Client scanne le QR code
=> le menu du restaurant s'ouvre
=> l'application verifie les features du plan
=> si plan Pro ou Business, bouton Assistant disponible
=> le client pose une question
=> le chatbot utilise le contexte du restaurant
=> il recommande, explique ou guide le client
=> le client ajoute au panier
=> la commande suit le flow normal
```

Questions possibles :

```txt
Quel plat est populaire ?
Je veux quelque chose pas trop cher.
Quels plats sont disponibles maintenant ?
Je suis allergique aux arachides.
Comment retrouver ma commande ?
Est-ce que je peux reserver une table ?
```

Contexte autorise pour le chatbot client :

```txt
restaurant
categories
plats disponibles
prix
devise
description des plats
plats populaires si la statistique est disponible
horaires et adresse si configures
statut de commande du client si une commande est en cours
```

Le chatbot client ne doit pas executer d'action sensible tout seul. Il peut preparer ou suggerer, mais la validation reste faite par le client :

```txt
recommandation de plat => client clique Ajouter
retrouver commande => client confirme son code ou telephone
reservation => client remplit et confirme le formulaire
```

### 32.3 Flow Assistant Intelligent cote restaurant

L'Assistant Intelligent cote restaurant apparait dans `e-resto-Angular`, dans le dashboard ou la topbar, uniquement pour les plans Business.

Flow :

```txt
Restaurant ouvre le dashboard
=> bouton Assistant E-RESTO visible si plan Business
=> le restaurant pose une question
=> l'assistant lit le contexte autorise
=> il explique, analyse ou recommande une action
=> le restaurant decide quoi faire
```

Questions possibles :

```txt
Quels plats se vendent le mieux cette semaine ?
Pourquoi mes revenus ont baisse aujourd'hui ?
Comment creer un QR code ?
Que me manque-t-il pour mieux vendre ?
Mon plan actuel permet-il les Réservations ?
Quels plats dois-je mettre en avant ?
```

Contexte autorise pour l'assistant restaurant :

```txt
plan actuel
features autorisees
commandes agregees
plats les plus commandes
revenus par devise
Réservations
feedbacks
etat des tables
utilisation des quotas
```

L'assistant restaurant doit rester un copilote. Il peut recommander une action mais ne doit pas modifier le menu, les prix ou les statuts sans confirmation explicite.

### 32.4 Flow fidelite client

Le module fidelite permet au restaurant de recompenser les clients qui reviennent.

Flow principal :

```txt
Client commande via QR code
=> il renseigne telephone ou email
=> la commande est confirmee
=> si paiement confirme ou commande servie, des points sont ajoutes
=> le client voit son solde fidelite
=> quand un seuil est atteint, une recompense est debloquee
=> la recompense peut etre utilisee sur une prochaine commande
```

Regles possibles :

```txt
1 000 CDF depenses = 1 point
1 USD depense = 1 point
1 commande servie = 1 tampon
10 tampons = 1 boisson offerte
50 points = 10% de reduction
```

Flow cote restaurant :

```txt
Restaurant ouvre Fidelite
=> choisit le mode : points, tampons ou coupons
=> definit les regles
=> active la fidelite
=> suit les clients fideles
=> voit les recompenses utilisees
=> lance des campagnes
```

Campagnes possibles :

```txt
10 commandes = 1 plat offert
-10% apres 5 visites
Happy hour entre 15h et 17h
Coupon anniversaire
Offre clients inactifs depuis 30 jours
```

### 32.5 Parcours client ideal

```txt
Client scanne le QR code
=> consulte le menu
=> demande conseil au chatbot
=> commande
=> gagne des points fidelite
=> recoit une recompense
=> revient commander
```

### 32.6 Parcours restaurant ideal

```txt
Restaurant configure son menu
=> active le chatbot selon son plan
=> active la fidelite
=> recoit les commandes
=> suit les clients reguliers
=> lance des campagnes
=> augmente ses ventes
```

### 32.7 Positionnement marketing

Avec ces modules, E-RESTO devient :

```txt
un menu digital QR code
un systeme de commande
un assistant intelligent
un outil de fidelisation
un tableau de bord de croissance
```

Proposition de valeur :

```txt
Digitalisez votre restaurant.
Recevez vos commandes par QR code.
Conseillez vos clients avec un assistant intelligent.
Fidelisez vos clients.
Augmentez vos ventes.
```

## 25. Console interne e-resto-admin

`e-resto-admin` est maintenant l'application interne pour les developpeurs, administrateurs plateforme et support E-RESTO.

Elle permet de gerer les restaurants inscrits dans la plateforme :

- dashboard global avec total restaurants, actifs/essai, retards de paiement et MRR ;
- liste des restaurants avec recherche et filtres par statut ;
- creation manuelle d'un restaurant et du compte proprietaire initial ;
- modification des informations restaurant ;
- changement de statut : essai, actif, en retard, suspendu, annule ;
- changement de Plan ;
- activation ou suspension rapide ;
- gestion des plans SaaS : prix, devise, limites, fonctionnalites, plan populaire/actif ;
- suivi des paiements d'abonnement avec filtre par statut.
- wallet MaishaPay avec balance CDF et USD masquee par defaut ;
- support plateforme : messages contact, feedbacks et Réservations ;
- audit plateforme : derniers evenements restaurants et paiements ;
- reinitialisation du mot de passe proprietaire.

Endpoints backend ajoutes ou utilises :

```txt
GET    /api/saas/overview
GET    /api/saas/restaurants
POST   /api/saas/restaurants
PUT    /api/saas/restaurants/{restaurant}
DELETE /api/saas/restaurants/{restaurant}
GET    /api/saas/plans
POST   /api/saas/plans
PUT    /api/saas/plans/{plan}
DELETE /api/saas/plans/{plan}
GET    /api/saas/payments
GET    /api/saas/wallet/balance
GET    /api/saas/support
GET    /api/saas/audit
POST   /api/saas/restaurants/{restaurant}/reset-owner-password
```

Quand le plan ou le statut d'un restaurant change depuis `e-resto-admin`, le backend synchronise aussi la subscription active du restaurant.

Le wallet appelle MaishaPay via `POST /wallet/balance/report` avec les memes `MAISHAPAY_PUBLIC_KEY`, `MAISHAPAY_SECRET_KEY` et `MAISHAPAY_GATEWAY_MODE` que les paiements d'abonnement.

Les plans par defaut `Free Demo`, `Starter`, `Pro` et `Enterprise` sont crees seulement s'ils n'existent pas encore. Les modifications faites depuis `e-resto-admin` ne sont donc plus ecrasees automatiquement au chargement de `/api/saas/overview` ou `/api/saas/plans`.

## 27. Changements produit 2026-06-06

### 27.1 Feedback landing

Les formulaires de la landing affichent maintenant un retour visible sous le bouton :

- contact restaurant : message vert de confirmation pendant quelques secondes apres envoi ;
- newsletter : message vert confirmant que l'email est enregistre ;
- erreurs API : message rouge clair dans l'application.

### 27.2 Commandes client et WhatsApp

Le client final ne paie plus ses commandes par Mobile Money dans `e-resto-client`.

- Commande sur place : paiement cash confirme par le restaurant dans le dashboard.
- Commande a emporter : la commande est enregistree dans le backend et arrive dans le dashboard du restaurant, sans WhatsApp.
- Commande hors restaurant : si le client n'a pas scanne de table, il renseigne nom, telephone et adresse. La commande est enregistree dans le backend puis WhatsApp s'ouvre avec un message pret a envoyer au restaurant.
- Le numero WhatsApp se configure dans `Parametres du restaurant > WhatsApp commandes hors restaurant`.
- Si aucun numero WhatsApp n'est configure, l'application le signale avant l'envoi.

### 27.3 Paiement abonnement

Mobile Money reste actif pour le paiement d'abonnement SaaS dans `/restaurant/checkout`.

Le message technique `Gateway Mobile Money injoignable` est remplace par un message utilisateur : `Paiement echoue. Verifiez le numero puis reessayez.`

Si un restaurant arrive sur le checkout parce que son abonnement a expire, la page affiche un message de reactivation.

### 27.4 Plans et roles

Le plan Starter est limite a 3 roles. Si le restaurant essaie d'en creer plus, le backend renvoie une erreur visible dans l'application.

Le chatbot client est retire de l'application client et du pricing. L'assistant dashboard peut rester une fonctionnalite interne selon le plan.

### 27.5 Quand utiliser Redis

Redis est deja prevu dans `docker-compose.yml`. Dans cette application, il devient utile quand on veut :

- gerer les queues Laravel pour envoyer les emails sans bloquer les requetes ;
- accelerer le cache de permissions, plans et statistiques ;
- fiabiliser le Temps réel et les notifications si le volume de commandes augmente ;
- stocker temporairement des verrous ou etats courts, par exemple anti-spam newsletter/contact.

Pour l'activer en production : utiliser `CACHE_STORE=redis`, `QUEUE_CONNECTION=redis`, verifier `REDIS_HOST`, puis lancer un worker Laravel avec `php artisan queue:work`.
