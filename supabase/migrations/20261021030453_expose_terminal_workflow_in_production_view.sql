-- Views expand `table.*` when they are created. The terminal fields were added
-- later to production_runs, so append them explicitly without changing the
-- position or name of the existing view columns.
create or replace view public.inventory_production_runs
with(security_invoker = true)
as
select
  r.id,
  r.request_id,
  r.completion_request_id,
  r.code,
  r.status,
  r.started_at,
  r.completed_at,
  r.output_lot_id,
  r.created_by,
  r.completed_by,
  r.created_at,
  coalesce(inputs.input_count, 0) as input_count,
  coalesce(inputs.total_input_cost, 0) as total_input_cost,
  coalesce(inputs.input_summary, '') as input_summary,
  output_lot.code as output_lot_code,
  output_lot.quantity as output_quantity,
  output_lot.unit as output_unit,
  output_product.name as output_product_name,
  output_variant.name as output_variant_name,
  output_variant.is_default as output_is_default,
  output_location.name as output_location_name,
  r.workflow_version,
  r.workflow_phase,
  r.workflow_step,
  r.workflow_data,
  r.workflow_updated_at
from public.production_runs r
left join lateral (
  select
    count(*) as input_count,
    sum(i.input_cost) as total_input_cost,
    string_agg(
      product.name ||
        case when variant.is_default then '' else ' · ' || variant.name end ||
        ' — ' || i.quantity || ' ' || i.unit,
      ', ' order by i.created_at, i.id
    ) as input_summary
  from public.production_inputs i
  join public.lots source_lot on source_lot.id = i.source_lot_id
  join public.item_variants variant on variant.id = source_lot.variant_id
  join public.products product on product.id = variant.product_id
  where i.production_run_id = r.id
) inputs on true
left join public.lots output_lot on output_lot.id = r.output_lot_id
left join public.item_variants output_variant on output_variant.id = output_lot.variant_id
left join public.products output_product on output_product.id = output_variant.product_id
left join public.storage_locations output_location
  on output_location.id = output_lot.location_id;
