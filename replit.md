# BCCL Contractor Payment Verification System

## Overview

This is a web-based contractor payment verification system for BCCL (Bharat Coking Coal Limited). The application provides a three-tier interface with Admin, Contractor, and Worker roles for managing payment workflows. Admins create payments to contractors, contractors manage their payments and workers, and workers can verify their payment status. The system is built as a lightweight MVP with in-memory data storage for rapid prototyping and demonstration purposes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: Vanilla HTML5, CSS3, and JavaScript with Bootstrap 5.3.3 framework
- **UI Framework**: Bootstrap with custom glass-morphism styling using backdrop-filter effects
- **Design Pattern**: Single Page Application (SPA) with tab-based navigation between Admin, Contractor, and Worker interfaces
- **State Management**: Client-side data storage using JavaScript arrays for payments and workers data
- **API Communication**: Fetch API for asynchronous HTTP requests to Flask backend with comprehensive error handling

### Backend Architecture
- **Framework**: Flask (Python) with minimal configuration optimized for rapid prototyping
- **API Design**: RESTful endpoints following `/api/` prefix convention for clear separation
- **Data Storage**: In-memory data structures using Python lists and dictionaries (MVP approach)
- **CORS**: Enabled for all routes to support cross-origin requests during development
- **Static File Serving**: Flask serves both API endpoints and static frontend assets from same server

### Application Structure
- **Multi-Role Interface**: Three distinct user dashboards with role-specific functionality
- **Payment Workflow**: Linear flow from Admin payment creation → Contractor management → Worker verification
- **Real-time Updates**: Automatic list refreshing after CRUD operations to maintain data consistency
- **Form Validation**: Dual-layer validation with client-side checks and server-side sanitization

### Security Considerations
- **Session Management**: Flask session secret key configuration with environment variable fallback
- **Input Validation**: Required field validation, data type checking, and trim operations
- **Error Handling**: Controlled error message exposure with user-friendly feedback

## External Dependencies

### Frontend Dependencies
- **Bootstrap 5.3.3**: Responsive CSS framework for component styling and grid layout
- **Bootstrap Icons 1.11.3**: Comprehensive icon library for consistent UI elements
- **CDN Delivery**: All frontend libraries loaded via CDN for simplified deployment and caching

### Backend Dependencies
- **Flask**: Lightweight Python web framework for API development
- **Flask-CORS**: Cross-Origin Resource Sharing middleware for frontend-backend communication
- **Python Standard Library**: Built-in modules (logging, datetime, os) for core functionality

### Development Environment
- **Python 3.x**: Required runtime for Flask backend
- **Modern Web Browser**: Support for ES6+ JavaScript features and CSS backdrop-filter
- **Development Server**: Flask's built-in development server with debug mode enabled