class Order < ApplicationRecord
  self.table_name = "purchase_orders"
  belongs_to :user
end
