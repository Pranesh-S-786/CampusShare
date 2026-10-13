from datetime import datetime, timezone
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint to verify backend service status and database connectivity.
    """
    db_status = 'unreachable'
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            row = cursor.fetchone()
            if row and row[0] == 1:
                db_status = f'connected ({connection.vendor})'
    except Exception as exc:
        db_status = f'disconnected ({type(exc).__name__})'

    return Response({
        'status': 'healthy',
        'service': 'CampusShare API',
        'database': db_status,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })
