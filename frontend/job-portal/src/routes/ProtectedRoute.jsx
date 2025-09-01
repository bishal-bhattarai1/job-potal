import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const ProtectedRoute = ({ requiredRole }) => {
  
  // will implement later
  return <Outlet />;
};

export default ProtectedRoute;