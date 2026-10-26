using System;
using System.Net.Http;
using System.Threading.Tasks;

public class ShippingClient
{
    private readonly HttpClient _http;

    public ShippingClient(HttpClient http)
    {
        _http = http;
        _http.BaseAddress = new Uri(Environment.GetEnvironmentVariable("SHIPPING_URL"));
    }

    public async Task<string> Track(string id)
    {
        var res = await _http.GetAsync($"/parcels/{id}");
        return await res.Content.ReadAsStringAsync();
    }
}
