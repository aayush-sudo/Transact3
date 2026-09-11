from app.models.schemas import TCACalculateRequest, TCACalculateResponse

class TCAService:
    def calculate(self, req: TCACalculateRequest) -> TCACalculateResponse:
        amount = req.source_amount_usd
        actual_rail_fee = req.selected_rail_fee_usd
        fx_cost = req.fx_cost_usd

        # If swift baseline not provided, SWIFT baseline is $25 base + 10 bps
        if req.swift_baseline_fee_usd is not None:
            swift_rail_fee = req.swift_baseline_fee_usd
        else:
            swift_rail_fee = 25.00 + (amount * 0.0010)

        total_actual = round(actual_rail_fee + fx_cost, 2)
        total_swift = round(swift_rail_fee + fx_cost, 2)

        cost_saved = round(max(0.0, total_swift - total_actual), 2)
        cost_saved_bps = round((cost_saved / amount) * 10000.0, 1) if amount > 0 else 0.0

        time_saved = round(max(0.0, req.swift_baseline_latency_hours - req.selected_latency_hours), 2)

        rail_share = round((actual_rail_fee / total_actual) * 100.0, 1) if total_actual > 0 else 50.0
        fx_share = round((fx_cost / total_actual) * 100.0, 1) if total_actual > 0 else 50.0

        return TCACalculateResponse(
            source_amount_usd=amount,
            actual_rail_fee_usd=actual_rail_fee,
            fx_cost_usd=fx_cost,
            total_actual_cost_usd=total_actual,
            swift_baseline_cost_usd=total_swift,
            cost_saved_usd=cost_saved,
            cost_saved_bps=cost_saved_bps,
            actual_latency_hours=req.selected_latency_hours,
            swift_latency_hours=req.swift_baseline_latency_hours,
            time_saved_hours=time_saved,
            rail_share_pct=rail_share,
            fx_share_pct=fx_share
        )

tca_service = TCAService()
