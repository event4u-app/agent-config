<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function store(Request $request)
    {
        $project = Project::create($request->validated()); /* gt:uncovered */
        return response()->json($project, 201);
    }

    public function update(Request $request, Project $project)
    {
        $project->update($request->validated()); /* gt:uncovered */
        return response()->json($project);
    }

    public function destroy(int $id)
    {
        Project::destroy($id); /* gt:uncovered */
        return response()->noContent();
    }
}
