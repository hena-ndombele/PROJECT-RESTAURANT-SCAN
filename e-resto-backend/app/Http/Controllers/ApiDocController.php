<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Bus\DispatchesJobs;
use Illuminate\Foundation\Validation\ValidatesRequests;

/**
 * @OA\Info(
 *     title="E-RESTO API",
 *     version="1.0.0",
 *     description="Documentation des endpoints de mon application E-RESTO"
 * )
 *
 * @OA\Server(
 *     url="http://localhost:8000",
 *     description="Serveur local"
 * )
 */
class ApiDocController extends Controller
{
    use AuthorizesRequests, DispatchesJobs, ValidatesRequests;
}
