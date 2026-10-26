<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class PartnerClient
{
    public function sync(array $orders)
    {
        return Http::withToken(config('services.partner.key'))
            ->post(config('services.partner.url') . '/orders', $orders);
    }

    public function ping()
    {
        return Http::post('https://partner.example.com/api/ping', []);
    }

    public function stock(string $sku)
    {
        $client = new \SoapClient('https://partner.example.com/stock?wsdl');

        return $client->GetStock(['sku' => $sku]);
    }
}
