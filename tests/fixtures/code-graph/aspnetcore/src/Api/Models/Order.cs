using System.ComponentModel.DataAnnotations.Schema;

namespace Api.Models;

[Table("purchase_orders")]
public class Order
{
    public int Id { get; set; }
}
