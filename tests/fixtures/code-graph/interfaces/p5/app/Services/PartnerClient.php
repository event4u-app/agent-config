<?php

namespace App\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Http;

class PartnerClient
{
    private Client $erp;

    private \SoapClient $soap;

    public function __construct()
    {
        $this->erp = new Client(['base_uri' => 'https://erp.acme-erp.example/api/']);
        $this->soap = new \SoapClient(resource_path('wsdl/stock.wsdl'));
    }

    public function stock(string $sku): array
    {
        return Http::withToken(config('services.partner.key'))
            ->get(config('services.partner.url') . '/stock/' . $sku)
            ->json();
    }

    public function placeOrder(string $sku, int $qty): array
    {
        return Http::withToken(config('services.partner.key'))
            ->post(config('services.partner.url') . '/orders', ['sku' => $sku, 'qty' => $qty])
            ->json();
    }

    public function cancel(string $orderId): void
    {
        Http::withToken(config('services.partner.key'))
            ->delete(config('services.partner.url') . "/orders/{$orderId}/cancel");
    }

    public function prices(string $sku): string
    {
        return (string) $this->erp->get('prices/' . $sku)->getBody();
    }

    public function warehouseStock(string $sku): object
    {
        return $this->soap->GetStock(['ItemCode' => $sku]);
    }
}
