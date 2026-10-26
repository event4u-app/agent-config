import zeep


def stock(code):
    client = zeep.Client("https://soap.remote-stock.example/service?wsdl")
    return client.service.GetStock(ItemCode=code)
