<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;

// Parent class carrying the auditing trait (inherited coverage case).
abstract class BaseAuditableModel extends Model
{
    use LogsActivity;
}
