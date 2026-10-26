package fixture;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;

public class PartnerGateway {
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${partner.url}")
    private String partnerUrl;

    public String stock(String sku) {
        return restTemplate.getForObject(partnerUrl + "/stock/" + sku, String.class);
    }
}
