<?php
// S0.5 fixture — TRUE F9: ML/AI inference call in the request path.
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use OpenAI\Laravel\Facades\OpenAI;

class SummaryController extends Controller
{
    public function summarize(Request $request)
    {
        $result = OpenAI::chat()->create([
            'model' => 'gpt-4o-mini',
            'messages' => [['role' => 'user', 'content' => $request->input('text')]],
        ]);
        return response()->json(['summary' => $result->choices[0]->message->content]);
    }
}
