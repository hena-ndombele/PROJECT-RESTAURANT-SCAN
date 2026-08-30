<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Saas\NewsletterController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/newsletter/confirm/{subscriber}/{token}', [NewsletterController::class, 'confirm'])->name('newsletter.confirm');
Route::get('/newsletter/unsubscribe/{subscriber}', [NewsletterController::class, 'unsubscribe'])->name('newsletter.unsubscribe');
