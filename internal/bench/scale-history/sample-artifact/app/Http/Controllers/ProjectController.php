<?php
// Dry-smoke sample artifact — seeded defects: unbounded index() (F3),
// inline Mail::send on status change (F9).
namespace App\Http\Controllers;

use App\Mail\ProjectStatusChanged;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ProjectController extends Controller
{
    public function index()
    {
        return response()->json(Project::where('tenant_id', auth()->user()->tenant_id)->get());
    }

    public function updateStatus(Request $request, Project $project)
    {
        $project->update(['status' => $request->input('status')]);
        Mail::send(new ProjectStatusChanged($project));
        return response()->json($project);
    }
}
