from django.core.management.base import BaseCommand
from apps.marketplace.models import Category
from apps.authentication.models import College


class Command(BaseCommand):
    help = 'Seeds initial standard marketplace categories and institutional colleges'

    def handle(self, *args, **options):
        # 1. Standard categories
        categories_data = [
            {'name': 'Books', 'slug': 'books', 'icon': 'book-open', 'order': 1, 'description': 'Course textbooks, reference books, novels, guides'},
            {'name': 'Electronics', 'slug': 'electronics', 'icon': 'laptop', 'order': 2, 'description': 'Laptops, tablets, calculators, cables, chargers'},
            {'name': 'Lab Equipment', 'slug': 'lab-equipment', 'icon': 'flask-conical', 'order': 3, 'description': 'Lab coats, microscopes, kits, breadboards, multimeters'},
            {'name': 'Sports', 'slug': 'sports', 'icon': 'trophy', 'order': 4, 'description': 'Badminton rackets, footballs, cricket gear, fitness items'},
            {'name': 'Furniture', 'slug': 'furniture', 'icon': 'armchair', 'order': 5, 'description': 'Study chairs, desks, lamps, organizers'},
            {'name': 'Accessories', 'slug': 'accessories', 'icon': 'headphones', 'order': 6, 'description': 'Headphones, bags, watches, accessories'},
            {'name': 'Clothing', 'slug': 'clothing', 'icon': 'shirt', 'order': 7, 'description': 'Blazers, formal wear, robes, ethnic wear for campus events'},
            {'name': 'Other', 'slug': 'other', 'icon': 'grid', 'order': 8, 'description': 'Miscellaneous campus utilities, tools, musical gear'},
        ]

        created_cat = 0
        for item in categories_data:
            cat, created = Category.objects.get_or_create(
                slug=item['slug'],
                defaults={
                    'name': item['name'],
                    'icon': item['icon'],
                    'order': item['order'],
                    'description': item['description'],
                    'is_active': True,
                }
            )
            if created:
                created_cat += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded {created_cat} categories (Total: {Category.objects.count()})."))

        # 2. Add extra colleges from reference UI if missing
        extra_colleges = [
            {
                'name': 'Kumaraguru College of Technology',
                'short_code': 'KCT',
                'domain': 'kct.ac.in',
                'city': 'Coimbatore',
                'state': 'Tamil Nadu',
            },
            {
                'name': 'Sri Krishna College of Engineering and Technology',
                'short_code': 'SKCET',
                'domain': 'skcet.ac.in',
                'city': 'Coimbatore',
                'state': 'Tamil Nadu',
            },
        ]

        created_colleges = 0
        for col_data in extra_colleges:
            college, created = College.objects.get_or_create(
                domain=col_data['domain'],
                defaults=col_data
            )
            if created:
                created_colleges += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded {created_colleges} additional colleges (Total: {College.objects.count()})."))
