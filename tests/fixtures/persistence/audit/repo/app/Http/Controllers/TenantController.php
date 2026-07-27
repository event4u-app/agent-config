<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    public function store(Request $request)
    {
        $tenant = Tenant::create($request->validated()); /* gt:covered */
        return response()->json($tenant, 201);
    }

    public function update(Request $request, Tenant $tenant)
    {
        $tenant->fill($request->validated());
        $tenant->save(); /* gt:covered */
        return response()->json($tenant);
    }

    public function destroy(Tenant $tenant)
    {
        $tenant->delete(); /* gt:covered */
        return response()->noContent();
    }
}
