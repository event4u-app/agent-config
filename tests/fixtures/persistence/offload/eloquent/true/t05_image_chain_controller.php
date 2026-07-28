<?php
// S0.5 fixture — TRUE F9: heavy image processing chain + Browsershot in the handler.
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Intervention\Image\Facades\Image;
use Spatie\Browsershot\Browsershot;

class MediaController extends Controller
{
    public function store(Request $request)
    {
        $path = storage_path('app/media/' . uniqid() . '.webp');
        Image::make($request->file('photo'))->resize(1600, null)->encode('webp', 80)->save($path);
        Browsershot::url($request->input('preview_url'))->save(storage_path('app/shots/preview.png'));
        return response()->json(['path' => $path]);
    }
}
