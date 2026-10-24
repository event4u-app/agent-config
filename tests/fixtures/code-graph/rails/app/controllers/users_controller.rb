class UsersController < ApplicationController
  def index
    @users = User.all
  end

  def show
    @user = User.find(params[:id])
  end

  def create
    User.create(params)
  end

  def edit; end

  def destroy; end
end
