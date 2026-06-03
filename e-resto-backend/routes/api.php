<?php
use App\Http\Controllers\users\AuthController;
use App\Http\Controllers\category\CategoryController;
use App\Http\Controllers\roles\RoleController;
use App\Http\Controllers\tables\TableController;
use App\Http\Controllers\plats\PlatController;
use App\Http\Controllers\order\OrderController;
use App\Http\Controllers\users\AccountRequestController;
use App\Http\Controllers\agents\AgentController;
use App\Http\Controllers\permissions\PermissionController;
use App\Http\Controllers\Public\ContactController;
use App\Http\Controllers\Public\MenuController;
use App\Http\Controllers\Public\ReservationController;
use App\Http\Controllers\Public\FeedbackController;
use App\Http\Controllers\Saas\SaasController;

//*****************************************ADMIN****************************************************************
//users
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/otp/request', [AuthController::class, 'requestOtp']);
Route::post('/auth/account-request', [AccountRequestController::class, 'store']);

//*****************************************SAAS PLATFORM***************************************************************
Route::prefix('saas')->group(function () {
    Route::get('/overview', [SaasController::class, 'overview']);
    Route::get('/plans', [SaasController::class, 'plans']);
    Route::post('/newsletter', [SaasController::class, 'newsletterSubscribe']);
    Route::post('/plans', [SaasController::class, 'storePlan']);
    Route::put('/plans/{plan}', [SaasController::class, 'updatePlan']);
    Route::delete('/plans/{plan}', [SaasController::class, 'destroyPlan']);
    Route::post('/signup', [SaasController::class, 'signup']);
    Route::post('/checkout/mobile-money', [SaasController::class, 'checkout']);
    Route::post('/login', [SaasController::class, 'login']);
    Route::get('/google/config', [SaasController::class, 'googleConfig']);
    Route::post('/google/login', [SaasController::class, 'googleLogin']);
    Route::post('/payment-callback', [SaasController::class, 'paymentCallback']);
    Route::post('/register-interest', [SaasController::class, 'registerInterest']);
    Route::get('/wallet/balance', [SaasController::class, 'walletBalance']);
    Route::get('/support', [SaasController::class, 'supportCenter']);
    Route::get('/audit', [SaasController::class, 'auditTrail']);
    Route::get('/payments', [SaasController::class, 'payments']);
    Route::get('/restaurants', [SaasController::class, 'restaurants']);
    Route::post('/restaurants', [SaasController::class, 'storeRestaurant']);
    Route::put('/restaurants/{restaurant}', [SaasController::class, 'updateRestaurant']);
    Route::post('/restaurants/{restaurant}/reset-owner-password', [SaasController::class, 'resetOwnerPassword']);
    Route::delete('/restaurants/{restaurant}', [SaasController::class, 'destroyRestaurant']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [SaasController::class, 'me']);
        Route::get('/restaurant/dashboard', [SaasController::class, 'dashboard']);
        Route::get('/restaurant/usage', [SaasController::class, 'usage']);
        Route::put('/restaurant/profile', [SaasController::class, 'updateProfile']);
    });
});

//*****************************************CLIENT PUBLIC***************************************************************
Route::get('/public/menu', [MenuController::class, 'index']);
Route::post('/public/contact', [ContactController::class, 'store']);
Route::post('/public/reservations', [ReservationController::class, 'store']);
Route::post('/public/feedbacks', [FeedbackController::class, 'store']);


Route::middleware('auth:sanctum')->group(function () {
    Route::post('/agents/create', [AgentController::class, 'store']);
    Route::get('/agents/list', [AgentController::class, 'index']);
    Route::delete('/agents/delete/{id}', [AgentController::class, 'destroy']);
    Route::get('/agents/show/{id}', [AgentController::class, 'show']);
    Route::put('/agents/update/{id}', [AgentController::class, 'update']);
});

Route::middleware('auth:sanctum')->group(function () {
   Route::get('/auth/account-request', [AccountRequestController::class, 'index']);
    Route::delete('/auth/account-request/{id}', [AccountRequestController::class, 'destroy']);
});


Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::get('/users/list', [AuthController::class, 'index']);
     Route::get('/users/search', [AuthController::class, 'search']);
    });

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/users/{id}', [AuthController::class, 'show']);
});

   Route::middleware('auth:sanctum')->group(function () {
   Route::put('/users/{id}', [AuthController::class, 'update']);
});
   Route::middleware('auth:sanctum')->group(function () {
  Route::delete('/users/{id}', [AuthController::class, 'destroy']);
});
Route::post('/auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::post('/auth/change-password', [AuthController::class, 'changePassword'])->middleware('auth:sanctum');


//********************************************gestion des roles**********************************************************
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/roles', [RoleController::class, 'store']);
    Route::get('/roles', [RoleController::class, 'index']);
    Route::get('/roles/search', [RoleController::class, 'search']);
    Route::get('/roles/{id}', [RoleController::class, 'show']);
    Route::delete('/roles/{id}', [RoleController::class, 'destroy']);
    Route::put('/roles/{id}', [RoleController::class, 'update']);
    Route::put('/roles/{id}/permissions', [RoleController::class, 'syncPermissions']);

    Route::get('/permissions', [PermissionController::class, 'index']);
    Route::get('/permissions/search', [PermissionController::class, 'search']);
    Route::get('/permissions/{id}', [PermissionController::class, 'show']);
});

//**************************************gestion des plats et categorie**************************************************
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/category/list', [CategoryController::class, 'index']);
    Route::post('/category/create', [CategoryController::class, 'store']);
    Route::get('/category/search', [CategoryController::class, 'search']);
    Route::get('/category/{id}', [CategoryController::class, 'show']);
    Route::post('/category/{id}', [CategoryController::class, 'update']);
    Route::put('/category/{id}', [CategoryController::class, 'update']);
    Route::delete('/category/{id}', [CategoryController::class, 'destroy']);

    Route::get('/plats/list', [PlatController::class, 'index']);
    Route::post('/plats/create', [PlatController::class, 'store']);
    Route::get('/search-plats', [PlatController::class, 'search']);
    Route::get('/plats/{id}', [PlatController::class, 'show']);
    Route::post('/plats/{id}', [PlatController::class, 'update']);
    Route::put('/plats/{id}', [PlatController::class, 'update']);
    Route::delete('/plats/{id}', [PlatController::class, 'destroy']);

    //******************************gestion du QRCODE de la Table**********************************************************
    Route::get('/tables', [TableController::class, 'index']);
    Route::post('/tables', [TableController::class, 'store']);
    Route::get('/tables/{id}', [TableController::class, 'show']);
    Route::put('/tables/{id}', [TableController::class, 'update']);
    Route::delete('/tables/{id}', [TableController::class, 'destroy']);
});

//*************************gestion des commandes ************************************************************************

Route::prefix('orders')->group(function () {

    Route::post('/', [OrderController::class, 'store']);
    Route::get('/track', [OrderController::class, 'track']);
    Route::post('/payment-callback', [OrderController::class, 'paymentCallback']);
    Route::patch('/{id}/cancel', [OrderController::class, 'cancelFromClient']);
    Route::patch('/{id}/items', [OrderController::class, 'updateItemsFromClient']);
    Route::patch('/{id}/request-bill', [OrderController::class, 'requestBillFromClient']);
    Route::get('/{id}', [OrderController::class, 'show']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/', [OrderController::class, 'index']);
        Route::delete('/', [OrderController::class, 'destroyAll']);
    Route::delete('/{id}', [OrderController::class, 'destroy']);
    Route::patch('/{id}/status', [OrderController::class, 'updateStatus']);
    Route::patch('/{id}/payment', [OrderController::class, 'updatePaymentStatus']);
    });
});

Route::middleware('auth:sanctum')->get('/feedbacks', [FeedbackController::class, 'index']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/reservations', [ReservationController::class, 'index']);
    Route::patch('/reservations/{id}/status', [ReservationController::class, 'updateStatus']);
    Route::delete('/reservations/{id}', [ReservationController::class, 'destroy']);
});
