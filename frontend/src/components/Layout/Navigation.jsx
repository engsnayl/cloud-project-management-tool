//workspaces/cloud-project-management-tool/frontend/src/components/Layout/Navigation.jsx

import React from 'react';
import { NavLink } from 'react-router-dom';

function Navigation() {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">DeliveryCommand</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <NavLink
                to="/actions"
                className={({ isActive }) =>
                  isActive
                    ? "border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                }
              >
                Actions
              </NavLink>
              <NavLink
                to="/documents"
                className={({ isActive }) =>
                  isActive
                    ? "border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                }
              >
                Bulk Upload
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;