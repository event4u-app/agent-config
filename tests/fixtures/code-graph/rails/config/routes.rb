Rails.application.routes.draw do
  root 'pages#home'
  resources :users, only: [:index, :show, :create, :edit, :update]
  get '/about', to: 'pages#about'
  post 'search' => 'pages#search'

  namespace :admin do
    resources :reports, only: [:index]
  end
end
