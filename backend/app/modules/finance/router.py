from typing import Optional, List, Dict
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.core.authz import get_user_company_ids, assert_building_access
from app.common.response import success_response
from app.modules.finance.models import BuildingExpense
from app.modules.finance.schemas import RecordExpenseInput
from app.modules.properties.models import Building, Room
from app.modules.billing.models import Invoice

finance_router = APIRouter(tags=["finance"])


@finance_router.get("/financial/pnl/consolidated")
@finance_router.get("/finance/pnl/consolidated")
async def get_consolidated_pnl(
    period_month: Optional[str] = Query(None, alias="periodMonth"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER")),
):
    month = period_month or datetime.now(timezone.utc).strftime("%Y-%m")
    
    # Calculate previous month
    year_str, month_str = month.split("-")
    prev_year = int(year_str)
    prev_month_num = int(month_str) - 1
    if prev_month_num == 0:
        prev_month_num = 12
        prev_year -= 1
    prev_month = f"{prev_year}-{prev_month_num:02d}"

    # Buildings query
    b_query = select(Building)
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if not user_companies:
            return success_response({
                "periodMonth": month,
                "portfolio": {
                    "totalProperties": 0,
                    "totalUnits": 0,
                    "grossBilledRevenue": 0.0,
                    "totalCollected": 0.0,
                    "totalOpex": 0.0,
                    "noi": 0.0,
                    "operatingMargin": 0,
                    "collectionRate": 0,
                    "momRevenueGrowth": 0,
                    "momNoiGrowth": 0,
                },
                "buildings": [],
            })
        b_query = b_query.where(Building.company_id.in_(user_companies))
            
    b_res = await db.execute(b_query)
    buildings = b_res.scalars().all()

    building_summaries = []
    port_total_rooms = 0
    port_gross_rev = Decimal("0.00")
    port_collected = Decimal("0.00")
    port_total_opex = Decimal("0.00")
    port_noi = Decimal("0.00")

    prev_port_gross_rev = Decimal("0.00")
    prev_port_noi = Decimal("0.00")

    for b in buildings:
        # Get rooms in building
        r_res = await db.execute(select(Room).where(Room.building_id == b.id))
        rooms = r_res.scalars().all()
        room_ids = [r.id for r in rooms]

        gross_billed = Decimal("0.00")
        total_collected = Decimal("0.00")
        revenue_breakdown: Dict[str, float] = {}

        if room_ids:
            # Current month invoices
            inv_res = await db.execute(
                select(Invoice).where(
                    Invoice.room_id.in_(room_ids),
                    Invoice.period_month == month
                )
            )
            invoices = inv_res.scalars().all()
            for inv in invoices:
                inv_total = Decimal(str(inv.total_amount))
                inv_paid = Decimal(str(inv.paid_amount))
                gross_billed += inv_total
                total_collected += inv_paid
                category = inv.status
                revenue_breakdown[category] = revenue_breakdown.get(category, 0.0) + float(inv_total)

            # Previous month invoices for MoM
            prev_inv_res = await db.execute(
                select(Invoice).where(
                    Invoice.room_id.in_(room_ids),
                    Invoice.period_month == prev_month
                )
            )
            for inv in prev_inv_res.scalars().all():
                prev_port_gross_rev += Decimal(str(inv.total_amount))

        # Current month expenses
        exp_res = await db.execute(
            select(BuildingExpense).where(
                BuildingExpense.building_id == b.id,
                BuildingExpense.period_month == month
            )
        )
        expenses = exp_res.scalars().all()
        total_expense = sum((Decimal(str(e.amount)) for e in expenses), Decimal("0.00"))
        expense_breakdown: Dict[str, float] = {}
        for e in expenses:
            e_amt = Decimal(str(e.amount))
            expense_breakdown[e.category] = expense_breakdown.get(e.category, 0.0) + float(e_amt)

        # Previous month expenses for MoM
        prev_exp_res = await db.execute(
            select(BuildingExpense).where(
                BuildingExpense.building_id == b.id,
                BuildingExpense.period_month == prev_month
            )
        )
        prev_expenses = prev_exp_res.scalars().all()
        prev_port_noi += sum((Decimal(str(e.amount)) for e in prev_expenses), Decimal("0.00"))

        net_income = gross_billed - total_expense
        gb_float = float(gross_billed)
        margin = round((float(net_income) / gb_float) * 100, 1) if gb_float > 0 else 0.0
        col_rate = round((float(total_collected) / gb_float) * 100, 1) if gb_float > 0 else 0.0
        outstanding = float(gross_billed - total_collected)

        building_summaries.append({
            "buildingId": b.id,
            "buildingName": b.name,
            "address": b.address,
            "totalRooms": len(rooms),
            "grossRevenue": gb_float,
            "revenueCollected": float(total_collected),
            "outstandingDebt": outstanding,
            "collectionRate": col_rate,
            "revenueBreakdown": revenue_breakdown,
            "totalOperatingExpense": float(total_expense),
            "expenseBreakdown": expense_breakdown,
            "netOperatingIncome": float(net_income),
            "operatingMargin": margin,
        })

        port_total_rooms += len(rooms)
        port_gross_rev += gross_billed
        port_collected += total_collected
        port_total_opex += total_expense
        port_noi += net_income

    p_gross_float = float(port_gross_rev)
    prev_gross_float = float(prev_port_gross_rev)
    p_noi_float = float(port_noi)
    prev_noi_float = float(prev_port_noi)

    mom_rev_growth = (
        round(((p_gross_float - prev_gross_float) / prev_gross_float) * 100, 1)
        if prev_gross_float > 0
        else 0.0
    )
    mom_noi_growth = (
        round(((p_noi_float - prev_noi_float) / abs(prev_noi_float)) * 100, 1)
        if prev_noi_float != 0
        else 0.0
    )
    port_margin = round((p_noi_float / p_gross_float) * 100, 1) if p_gross_float > 0 else 0.0
    port_col_rate = round((float(port_collected) / p_gross_float) * 100, 1) if p_gross_float > 0 else 0.0

    return success_response({
        "periodMonth": month,
        "previousMonth": prev_month,
        "portfolio": {
            "totalBuildings": len(buildings),
            "totalRooms": port_total_rooms,
            "grossRevenue": p_gross_float,
            "revenueCollected": float(port_collected),
            "totalOperatingExpense": float(port_total_opex),
            "netOperatingIncome": p_noi_float,
            "operatingMargin": port_margin,
            "collectionRate": port_col_rate,
            "momRevenueGrowth": mom_rev_growth,
            "momNoiGrowth": mom_noi_growth,
        },
        "buildings": building_summaries,
    })


@finance_router.get("/financial/expenses")
@finance_router.get("/finance/expenses")
@finance_router.get("/expenses")
async def get_expenses(
    building_id: Optional[str] = Query(None, alias="buildingId"),
    period_month: Optional[str] = Query(None, alias="periodMonth"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    query = select(BuildingExpense)
    if building_id:
        await assert_building_access(db, current_user, building_id)
        query = query.where(BuildingExpense.building_id == building_id)
    elif current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if not user_companies:
            return success_response([])
        query = query.join(Building, Building.id == BuildingExpense.building_id).where(
            Building.company_id.in_(user_companies)
        )
            
    if period_month:
        query = query.where(BuildingExpense.period_month == period_month)
        
    result = await db.execute(query.order_by(desc(BuildingExpense.expense_date)))
    expenses = result.scalars().all()
    
    data = [
        {
            "id": e.id,
            "buildingId": e.building_id,
            "category": e.category,
            "description": e.description,
            "amount": float(e.amount),
            "expenseDate": e.expense_date,
            "periodMonth": e.period_month,
            "vendorName": e.vendor_name,
            "receiptUrl": e.receipt_url,
            "createdBy": e.created_by,
        }
        for e in expenses
    ]
    return success_response(data)


@finance_router.post("/financial/expenses", status_code=status.HTTP_201_CREATED)
@finance_router.post("/finance/expenses", status_code=status.HTTP_201_CREATED)
@finance_router.post("/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: RecordExpenseInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    building = await assert_building_access(db, current_user, payload.buildingId)
    if payload.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_AMOUNT: Số tiền chi phí phải lớn hơn 0"
        )
        
    date_str = payload.expenseDate or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month_str = payload.periodMonth or date_str[:7]
    
    expense = BuildingExpense(
        building_id=payload.buildingId,
        category=payload.category,
        description=payload.description,
        amount=payload.amount,
        expense_date=date_str,
        period_month=month_str,
        vendor_name=payload.vendorName,
        receipt_url=payload.receiptUrl,
        created_by=current_user.user_id,
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    
    return success_response({
        "id": expense.id,
        "buildingId": expense.building_id,
        "category": expense.category,
        "description": expense.description,
        "amount": expense.amount,
        "expenseDate": expense.expense_date,
        "periodMonth": expense.period_month,
        "vendorName": expense.vendor_name,
    }, status_code=201)
