# Fivesom Mobile Hub

FIVESOM Mobile App — Development Brief

I want you to build a professional FIVESOM mobile application based directly on my existing FIVESOM website.

1. Main Requirement

The mobile app must be the mobile version of the existing FIVESOM web platform.

Do NOT create a different product or add random features.

Everything that currently exists and works on the FIVESOM website should be represented in the mobile app in a clean, responsive, native-mobile experience.

I will provide the FIVESOM UI/UX design reference that I want you to follow. Recreate the same visual identity, layout principles, branding, colors, typography, cards, navigation style, icons, spacing, and overall user experience for mobile.

The app should feel like the official FIVESOM mobile application—not a website simply placed inside a mobile WebView.

2. What is FIVESOM?

FIVESOM is a freelance services marketplace that connects:

Freelancers / Skilled Professionals ↔ Clients / Buyers

Freelancers create and publish services called Gigs.

A Gig allows a freelancer to present:

Service title

Service description

Price

Category

Skills

Portfolio / images

Delivery time

Packages

Additional information

Clients can discover these services, view freelancer profiles, compare services, contact freelancers, and purchase/request services.

The goal of FIVESOM is to make it easier for skilled people—especially across Africa—to showcase their skills and connect directly with clients.

3. Existing Web Platform

The existing FIVESOM website is the source of truth.

Before building the mobile app:

Inspect the existing FIVESOM website.

Identify all existing pages.

Identify all existing features.

Identify all existing user roles.

Identify all existing database tables.

Identify existing authentication.

Identify existing Supabase Storage buckets.

Identify existing Edge Functions/API integrations.

Identify existing payment/order logic.

Identify existing messaging/notification systems.

Identify existing security/RLS policies.

The mobile app must connect to the same backend and same Supabase project.

4. ONE SUPABASE PROJECT

This is extremely important.

DO NOT create a new database.

The existing FIVESOM website already uses Supabase.

The:

FIVESOM Website + FIVESOM Mobile App

must use:

ONE shared Supabase backend.

Architecture:

                    FIVESOM
                       │
             ┌─────────┴─────────┐
             │                   │
       FIVESOM WEB          FIVESOM MOBILE
             │                   │
             └─────────┬─────────┘
                       │
                    SUPABASE
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      Auth          Database        Storage
        │              │              │
        └──────────────┼──────────────┘
                       │
                Shared Data


If a freelancer creates a Gig from the website, that Gig must immediately be available in the mobile app.

If a client sends a message from the mobile app, it must appear on the website.

If an order is created from the mobile app, it must be visible on the website.

There must be one source of truth.

5. Authentication

Use the existing Supabase authentication system.

Users must be able to:

Sign up

Sign in

Sign out

Reset password

Update profile

Upload profile picture

Manage account

If the current web platform already supports social authentication, preserve it where technically possible.

Do not create a separate authentication system for mobile.

6. User Types

The app should support the same user roles that exist on the website.

Freelancer

A freelancer can:

Create profile

Add professional title

Add bio

Add skills

Add portfolio

Create Gigs

Edit Gigs

Publish Gigs

Manage Gigs

Receive orders

Communicate with clients

Manage earnings/orders

Manage account

Buyer / Client

A buyer can:

Browse services

Search freelancers

Search Gigs

Filter services

View Gig details

View freelancer profiles

Contact freelancers

Place orders

Manage orders

Track order status

Review completed work

Manage account

If the existing web application has additional roles or permissions, preserve them.

7. Main Mobile App Areas

The mobile application should include the functionality that already exists on the website.

At minimum, organize the mobile experience around areas such as:

Home

Show:

FIVESOM branding

Search

Categories

Popular services

Recommended Gigs

Featured freelancers

Relevant marketplace content

Explore / Discover

Users should be able to discover services.

Include:

Categories

Search

Filters

Sorting

Gig cards

Freelancer information

Prices

Delivery time

Gig Details

Display:

Gig images

Gig title

Freelancer

Description

Price

Delivery time

Skills

Portfolio

Packages if available

Reviews if available

Order CTA

Contact/message option

Freelancer Profile

Show:

Profile photo

Name

Professional title

Bio

Skills

Portfolio

Gigs

Reviews

Rating

Completed work/order information where appropriate

Create Gig

Freelancers should be able to create and manage their services from mobile.

Use the same fields and database structure as the website.

Orders

Users should be able to:

View orders

See order status

View order details

Communicate about an order

Submit/receive work where supported

Complete orders

Review services

Messages

Implement the existing FIVESOM messaging functionality from the website.

Messages must synchronize between:

Web ↔ Mobile

in real time where supported by the existing architecture.

Notifications

Use notifications for important marketplace events such as:

New message

New order

Order update

Gig interaction

Review

Important account events

Only implement notifications that correspond to functionality already present or required by the existing web platform.

Profile

Users should be able to manage:

Profile photo

Name

Bio

Professional information

Skills

Portfolio

Account settings

Security settings

Other existing profile functionality

8. Design Requirement

I will provide the design/reference images for the mobile app.

Use those designs as the primary visual reference.

The mobile application should maintain FIVESOM's existing identity:

Modern

Professional

Clean

Premium

Marketplace-focused

Easy to navigate

Mobile-first

Consistent branding

Do not randomly redesign the product.

Do not change the FIVESOM brand identity.

Do not introduce unnecessary colors, fonts, components, or visual styles that conflict with the existing FIVESOM website/design.

The mobile UI should feel like the same FIVESOM product.

9. Mobile Navigation

Use a proper mobile navigation system.

A bottom navigation structure can be used where appropriate, for example:

Home | Explore | Orders | Messages | Profile

But first inspect the existing website functionality and adapt the navigation according to the actual FIVESOM features.

Do not duplicate pages unnecessarily.

The goal is a simple and intuitive mobile experience.

10. Native Mobile Application

This should be a real mobile application, not simply a WebView wrapper.

Build the application using a technology suitable for production deployment to:

Apple

iPhone

iPad where appropriate

iOS

Android

Android phones

Android tablets where appropriate

The architecture should be suitable for publishing to:

Apple App Store

Google Play Store

Use a cross-platform architecture if appropriate so that one codebase can support both iOS and Android while maintaining native-quality performance.

11. Backend Architecture

The existing Supabase backend should remain the backend.

Use the existing:

Supabase Authentication

Supabase PostgreSQL database

Supabase Storage

Supabase Realtime

Supabase Edge Functions

Existing APIs/integrations

Do not duplicate business logic unnecessarily.

Do not create duplicate tables.

Do not create another Supabase project.

Do not migrate existing data unless absolutely necessary.

12. Database Compatibility

Before writing mobile-specific database code, inspect the current schema.

Identify:

Users

Profiles

Gigs

Categories

Orders

Messages

Reviews

Payments

Notifications

Portfolio

Any other existing FIVESOM tables

The mobile app must use the existing schema wherever possible.

If a new table is genuinely required, explain:

Why it is required.

What data it stores.

How it relates to the existing schema.

Whether it affects the website.

Do not silently modify the production database.

13. Security

Security is extremely important.

Respect the existing Supabase:

Row Level Security (RLS)

policies.

Users must only be able to access data they are authorized to access.

For example:

Users should only modify their own profiles.

Freelancers should only manage their own Gigs.

Users should only access authorized orders.

Private messages must remain private.

Sensitive payment information must not be exposed.

Admin functionality must remain protected.

Never expose Supabase service-role keys inside the mobile application.

Use secure environment variables and proper server-side/Edge Function logic for privileged operations.

14. Payments

Inspect the existing FIVESOM website payment system.

If payments already exist:

reuse the existing payment architecture.

Do not create a completely separate payment system for mobile unless technically required by Apple/Google policies.

The mobile payment flow must remain synchronized with the web platform.

Orders created through mobile must appear on web.

Orders created through web must appear on mobile.

15. Real-Time Synchronization

The app should synchronize important marketplace data with the website.

Example:

Freelancer creates Gig on Web
            ↓
        Supabase
            ↓
       Mobile App
            ↓
       Gig appears


And:

Client sends message on Mobile
            ↓
        Supabase
            ↓
       FIVESOM Web
            ↓
Freelancer sees message


Use Supabase Realtime where appropriate.

16. Performance

The mobile app must be optimized for real-world users, including users with slower internet connections.

Implement:

Image optimization

Lazy loading

Pagination

Efficient database queries

Caching where appropriate

Loading states

Empty states

Error states

Offline-friendly behavior where practical

Do not load the entire marketplace at once.

17. App States

Every important screen should have proper:

Loading State

Example:

Skeleton loaders instead of blank screens.

Empty State

Example:

"No services found."

Error State

Example:

"Something went wrong. Try again."

Success State

Example:

"Gig published successfully."

The app should feel polished and production-ready.

18. App Permissions

Only request permissions that are actually required.

Possible permissions may include:

Camera

Photo library

Notifications

Microphone

But only request them when the corresponding FIVESOM feature requires them.

Do not request unnecessary permissions.

19. Apple & Android Requirements

Prepare the application architecture for production deployment.

Include:

iOS

App icon

Splash screen

Proper safe-area handling

iPhone screen sizes

iOS navigation behavior

App Store production configuration

Android

App icon

Splash screen

Android screen sizes

Android navigation behavior

Google Play production configuration

The application must not look like a desktop website squeezed into a phone.

20. What NOT To Do

Do NOT:

Create a new Supabase project.

Create a separate database.

Create fake/mock marketplace data.

Build unrelated features.

Change the FIVESOM concept.

Replace the existing website backend.

Duplicate existing data.

Put secret Supabase keys inside the app.

Build a simple WebView wrapper.

Break the existing website.

Change existing database structures without explanation.

Remove existing website functionality.

Invent functionality that does not exist.

21. Development Process

Follow this order:

Step 1

Inspect the existing FIVESOM website.

Step 2

Inspect the existing Supabase project and schema.

Step 3

Map the website features to mobile screens.

Step 4

Review the mobile design references I provide.

Step 5

Create the mobile app architecture.

Step 6

Connect the app to the existing Supabase project.

Step 7

Implement authentication.

Step 8

Implement marketplace functionality.

Step 9

Implement profiles, Gigs, orders and messaging.

Step 10

Implement notifications and other existing features.

Step 11

Test Web ↔ Supabase ↔ Mobile synchronization.

Step 12

Test security and RLS.

Step 13

Test iOS and Android layouts.

Step 14

Optimize performance.

Step 15

Prepare production builds for Apple App Store and Google Play.

22. Final Goal

The final result should be:

FIVESOM Web + FIVESOM iOS + FIVESOM Android

all working as one platform.

The website and mobile applications should share:

One Supabase project
One database
One authentication system
One user ecosystem
One marketplace
One source of truth

The user should be able to start something on the website and continue it on mobile without feeling that they are using two different products.

The mobile application should simply bring the existing FIVESOM experience into a professional, fast, native mobile environment.

Important

Before making major architectural changes, show me what you discovered from the existing FIVESOM website and Supabase structure.

Do not make assumptions about the database.

Do not overwrite existing functionality.

Build carefully, cleanly, and production-ready.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/12335920-e456-4255-b9f2-2d82a4829367).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
