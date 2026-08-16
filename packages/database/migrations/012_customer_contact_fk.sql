-- New contact methods must belong to a canonical customer in the same tenant.
ALTER TABLE customer_contact_methods
  ADD CONSTRAINT customer_contact_methods_customer_fk
  FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id) NOT VALID;
