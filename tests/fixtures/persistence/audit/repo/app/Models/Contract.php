<?php

namespace App\Models;

// Tricky case: audit trait lives on the PARENT class -> still covered (a).
class Contract extends BaseAuditableModel
{
    protected $fillable = ['tenant_id', 'title', 'status'];
}
