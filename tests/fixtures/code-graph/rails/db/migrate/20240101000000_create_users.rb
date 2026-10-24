class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      t.string :name
    end
    create_table "purchase_orders" do |t|
    end
  end
end
