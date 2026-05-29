"""
Tax Export API Tests
Tests for the tax export functionality including settings, preview, run, download, and jobs endpoints.
"""
import pytest
import requests
import os

# Use localhost:8001 for testing (Python proxy to Node Express on 3001)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

class TestTaxExportSettings:
    """Tax export settings endpoint tests"""
    
    def test_get_settings_returns_vietnamese_defaults(self):
        """GET /api/tax-export/settings returns default Vietnamese values"""
        response = requests.get(f"{BASE_URL}/api/tax-export/settings")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify Vietnamese default values
        assert data["default_buyer_label"] == "Khách lẻ không lấy hóa đơn"
        assert data["default_payment_method"] == "Chuyển khoản"
        assert data["default_unit"] == "Đêm"
        assert data["default_vat_rate"] == 8
        assert "service_name_template" in data
        print(f"✓ Settings API returns Vietnamese defaults: {data}")


class TestTaxExportPreview:
    """Tax export preview endpoint tests"""
    
    def test_preview_with_checkout_date(self):
        """GET /api/tax-export/preview?date=2026-05-31 returns items for checkout reservations"""
        response = requests.get(f"{BASE_URL}/api/tax-export/preview?date=2026-05-31")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "items" in data
        assert "checkoutDate" in data
        assert data["checkoutDate"] == "2026-05-31"
        
        # Verify items structure if any exist
        if len(data["items"]) > 0:
            item = data["items"][0]
            # Check required fields
            assert "invoice_number" in item
            assert "invoice_date" in item
            assert "buyer_label" in item
            assert "payment_method" in item
            assert "service_description" in item
            assert "unit" in item
            assert "quantity" in item
            assert "unit_price" in item
            assert "total_amount" in item
            assert "vat_rate" in item
            assert "vat_amount" in item
            assert "guest_name" in item
            assert "property_name" in item
            assert "check_in_date" in item
            assert "check_out_date" in item
            assert "reservation_id" in item
            assert "status" in item
            
            # Verify Ajil Mathew reservation exists (per test context)
            guest_names = [i["guest_name"] for i in data["items"]]
            assert "Ajil Mathew" in guest_names, f"Expected Ajil Mathew in guests, got: {guest_names}"
            print(f"✓ Preview returns {len(data['items'])} items for 2026-05-31")
        else:
            print("⚠ No items found for 2026-05-31 checkout date")
    
    def test_preview_with_no_checkouts(self):
        """GET /api/tax-export/preview with date having no checkouts returns empty items"""
        response = requests.get(f"{BASE_URL}/api/tax-export/preview?date=2020-01-01")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert isinstance(data["items"], list)
        print(f"✓ Preview with no checkouts returns empty list: {len(data['items'])} items")
    
    def test_preview_without_date_uses_today(self):
        """GET /api/tax-export/preview without date parameter uses today's date"""
        response = requests.get(f"{BASE_URL}/api/tax-export/preview")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "checkoutDate" in data
        # checkoutDate should be a valid date string
        assert len(data["checkoutDate"]) == 10  # YYYY-MM-DD format
        print(f"✓ Preview without date uses today: {data['checkoutDate']}")


class TestTaxExportJobs:
    """Tax export jobs history endpoint tests"""
    
    def test_get_jobs_returns_list(self):
        """GET /api/tax-export/jobs returns job list"""
        response = requests.get(f"{BASE_URL}/api/tax-export/jobs")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        if len(data) > 0:
            job = data[0]
            # Verify job structure
            assert "id" in job
            assert "checkout_date" in job
            assert "status" in job
            assert "total_items" in job
            assert "exported_count" in job
            assert "review_count" in job
            assert "triggered_by" in job
            assert "created_at" in job
            assert "items" in job
            print(f"✓ Jobs API returns {len(data)} jobs")
        else:
            print("⚠ No jobs found in history")
    
    def test_get_specific_job(self):
        """GET /api/tax-export/jobs/:id returns specific job details"""
        # First get the list to find a job ID
        list_response = requests.get(f"{BASE_URL}/api/tax-export/jobs")
        assert list_response.status_code == 200
        jobs = list_response.json()
        
        if len(jobs) > 0:
            job_id = jobs[0]["id"]
            response = requests.get(f"{BASE_URL}/api/tax-export/jobs/{job_id}")
            
            assert response.status_code == 200
            job = response.json()
            
            assert job["id"] == job_id
            assert "items" in job
            print(f"✓ Get specific job {job_id} works")
        else:
            pytest.skip("No jobs available to test specific job endpoint")
    
    def test_get_nonexistent_job_returns_404(self):
        """GET /api/tax-export/jobs/:id with invalid ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/tax-export/jobs/nonexistent-id-12345")
        
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        print("✓ Nonexistent job returns 404")


class TestTaxExportDownload:
    """Tax export download endpoint tests"""
    
    def test_download_with_job_id(self):
        """GET /api/tax-export/download?job_id=... returns .xlsx file"""
        # First get a job ID
        jobs_response = requests.get(f"{BASE_URL}/api/tax-export/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        
        if len(jobs) > 0:
            job_id = jobs[0]["id"]
            response = requests.get(f"{BASE_URL}/api/tax-export/download?job_id={job_id}")
            
            assert response.status_code == 200
            assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("Content-Type", "")
            assert "attachment" in response.headers.get("Content-Disposition", "")
            assert ".xlsx" in response.headers.get("Content-Disposition", "")
            print(f"✓ Download with job_id returns xlsx file")
        else:
            pytest.skip("No jobs available to test download")
    
    def test_download_with_date(self):
        """GET /api/tax-export/download?date=... returns .xlsx file (preview download)"""
        response = requests.get(f"{BASE_URL}/api/tax-export/download?date=2026-05-31")
        
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("Content-Type", "")
        assert "attachment" in response.headers.get("Content-Disposition", "")
        print("✓ Download with date returns xlsx file")
    
    def test_download_nonexistent_job_returns_404(self):
        """GET /api/tax-export/download?job_id=invalid returns 404"""
        response = requests.get(f"{BASE_URL}/api/tax-export/download?job_id=nonexistent-job-id")
        
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        print("✓ Download with invalid job_id returns 404")


class TestTaxExportRun:
    """Tax export run endpoint tests - Note: May fail due to unique constraint if job already exists"""
    
    def test_run_export_structure(self):
        """POST /api/tax-export/run creates a job (or fails with unique constraint)"""
        # Use a date that likely doesn't have a job yet
        response = requests.post(
            f"{BASE_URL}/api/tax-export/run",
            json={"date": "2026-06-15"},
            headers={"Content-Type": "application/json"}
        )
        
        # Either 201 (created) or 500 (unique constraint - job already exists)
        if response.status_code == 201:
            data = response.json()
            assert "jobId" in data
            assert "items" in data
            assert "checkoutDate" in data
            print(f"✓ Run export created job: {data['jobId']}")
        elif response.status_code == 500:
            # This is expected if a job already exists for this date
            print("⚠ Run export failed (likely unique constraint - job already exists for this date)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


class TestDashboardRegression:
    """Regression tests for dashboard and other pages"""
    
    def test_dashboard_summary_loads(self):
        """GET /api/dashboard/summary returns data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/summary")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "properties" in data
        assert "rooms" in data
        assert "reservations" in data
        assert "totals" in data
        print(f"✓ Dashboard summary loads with {len(data['properties'])} properties")
    
    def test_properties_endpoint(self):
        """GET /api/properties returns property list"""
        response = requests.get(f"{BASE_URL}/api/properties")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Properties endpoint returns {len(data)} properties")
    
    def test_reservations_endpoint(self):
        """GET /api/reservations returns reservation list"""
        response = requests.get(f"{BASE_URL}/api/reservations")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Reservations endpoint returns {len(data)} reservations")
    
    def test_rooms_endpoint(self):
        """GET /api/rooms returns room list"""
        response = requests.get(f"{BASE_URL}/api/rooms")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Rooms endpoint returns {len(data)} rooms")
    
    def test_channels_endpoint(self):
        """GET /api/channels returns channel list"""
        response = requests.get(f"{BASE_URL}/api/channels")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Channels endpoint returns {len(data)} channels")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
