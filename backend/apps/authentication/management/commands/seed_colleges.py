from django.core.management.base import BaseCommand
from apps.authentication.models import College


class Command(BaseCommand):
    help = 'Seeds initial active college registry for campus verification'

    def handle(self, *args, **options):
        initial_colleges = [
            {
                'name': 'Coimbatore Institute of Technology (CIT)',
                'short_code': 'CIT',
                'domain': 'cit.edu.in',
                'city': 'Coimbatore',
                'state': 'Tamil Nadu',
            },
            {
                'name': 'PSG College of Technology',
                'short_code': 'PSG',
                'domain': 'psgtech.edu',
                'city': 'Coimbatore',
                'state': 'Tamil Nadu',
            },
            {
                'name': 'Anna University / CEG Guindy',
                'short_code': 'AU',
                'domain': 'annauniv.edu',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
            },
            {
                'name': 'Indian Institute of Technology Madras',
                'short_code': 'IITM',
                'domain': 'iitm.ac.in',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
            },
            {
                'name': 'National Institute of Technology Trichy',
                'short_code': 'NITT',
                'domain': 'nitt.edu',
                'city': 'Tiruchirappalli',
                'state': 'Tamil Nadu',
            },
        ]

        count = 0
        for data in initial_colleges:
            college, created = College.objects.update_or_create(
                short_code=data['short_code'],
                defaults=data,
            )
            if created:
                count += 1
                self.stdout.write(self.style.SUCCESS(f"Created college: {college.name}"))
            else:
                self.stdout.write(f"Updated college: {college.name}")

        self.stdout.write(self.style.SUCCESS(f"Seeding completed. Total active colleges: {College.objects.count()}"))
