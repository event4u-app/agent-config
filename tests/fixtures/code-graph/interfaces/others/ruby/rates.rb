require 'net/http'

class Rates
  def today
    Net::HTTP.get(URI("#{ENV['FX_URL']}/today"))
  end
end
