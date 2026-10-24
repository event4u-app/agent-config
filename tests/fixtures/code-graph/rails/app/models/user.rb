class User < ApplicationRecord
  has_many :orders
  has_one :profile
  has_many :ghosts
  belongs_to :manager, class_name: "Person"
end
