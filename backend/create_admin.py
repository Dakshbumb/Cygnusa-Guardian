#!/usr/bin/env python3
"""
Cygnusa Guardian - Admin Account Bootstrap Script

Creates the first admin user. Run this once on a fresh deployment.

Usage:
    python create_admin.py --email admin@company.com --password yourpassword --name "Admin Name"

Options:
    --email     Admin email address (required)
    --password  Admin password, min 8 chars (required)
    --name      Display name (default: "Administrator")
    --reset     If the email already exists, reset its password instead of erroring
"""

import argparse
import sys
import os

# Ensure we can import backend modules when run from any directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import uuid
from database import Database
from auth import hash_password
from models import User, UserRole


def main():
    parser = argparse.ArgumentParser(
        description="Bootstrap the first Cygnusa Guardian admin account."
    )
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password (min 8 chars)")
    parser.add_argument("--name", default="Administrator", help="Display name")
    parser.add_argument(
        "--reset", action="store_true",
        help="Reset password if the email already exists"
    )
    args = parser.parse_args()

    if len(args.password) < 8:
        print("❌ Password must be at least 8 characters.")
        sys.exit(1)

    db = Database()

    # Check if email already exists
    existing_user, _ = db.get_user_with_hash(args.email)

    if existing_user:
        if not args.reset:
            print(f"❌ An account already exists for {args.email}.")
            print("   Use --reset to update the password instead.")
            sys.exit(1)
        # Reset password
        new_hash = hash_password(args.password)
        db.update_user_password(existing_user.id, new_hash)

        # Ensure role is admin
        existing_user.role = UserRole.ADMIN
        db.save_user(existing_user)

        print(f"✅ Password reset for {args.email} (role: admin).")
        return

    # Create new admin
    user = User(
        id=f"u_{uuid.uuid4().hex[:8]}",
        email=args.email,
        role=UserRole.ADMIN,
        name=args.name,
    )
    pw_hash = hash_password(args.password)
    db.save_user(user, password_hash=pw_hash)

    print(f"✅ Admin account created:")
    print(f"   Email : {args.email}")
    print(f"   Name  : {args.name}")
    print(f"   Role  : admin")
    print(f"   ID    : {user.id}")
    print()
    print("You can now log in at /login with these credentials.")


if __name__ == "__main__":
    main()
