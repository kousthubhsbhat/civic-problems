-- ============================================================================
-- SMART CIVIC GOVERNANCE PLATFORM - SEED REFERENCE DEPARTMENTS
-- Note: NO fake complaints or default dashboard statistics are populated here.
-- The dashboard must start empty and display actual database records.
-- ============================================================================

INSERT INTO public.departments (id, department_name, description)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Roads & Infrastructure', 'Potholes, road damage, traffic signal issues, footpath maintenance, and bridges'),
    ('00000000-0000-0000-0000-000000000002', 'Water Supply & Sewage', 'Water leaks, contaminated supply, drainage blockages, and overflow problems'),
    ('00000000-0000-0000-0000-000000000003', 'Sanitation & Solid Waste', 'Uncollected garbage, illegal dumping, public bins overflowing, and street sweeping'),
    ('00000000-0000-0000-0000-000000000004', 'Electricity & Public Lighting', 'Street light outages, dangerous hanging wires, transformer sparks, and power hazards'),
    ('00000000-0000-0000-0000-000000000005', 'Public Health & Safety', 'Stray animal hazards, vector breeding, noise violations, and public hazard alerts'),
    ('00000000-0000-0000-0000-000000000006', 'Parks & Urban Greenery', 'Fallen trees, park maintenance, encroachment, and playground safety')
ON CONFLICT (department_name) DO UPDATE SET
    description = EXCLUDED.description;
