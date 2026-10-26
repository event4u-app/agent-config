package inventory

import (
	"context"
	"net/http"
	"os"

	pb "example.test/inventory/gen"
	"google.golang.org/grpc"
)

func Stock(ctx context.Context, conn *grpc.ClientConn, sku string) (int32, error) {
	client := pb.NewInventoryClient(conn)
	reply, err := client.GetStock(ctx, &pb.StockRequest{Sku: sku})
	if err != nil {
		return 0, err
	}
	return reply.Qty, nil
}

func Rates() (*http.Response, error) {
	return http.Get(os.Getenv("RATES_URL") + "/today")
}
