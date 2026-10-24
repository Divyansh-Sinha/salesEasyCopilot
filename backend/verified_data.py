VERIFIED_STOCK = {
    "indiranagar mart": {"Cola 500ml": 0},
    "metro fresh": {"Cola 500ml": 48},
    "city corner": {"Juice 1L": 12},
}


def lookup_stock(outlet: str, sku: str):
    if not outlet or not sku:
        return None
    outlet_data = VERIFIED_STOCK.get(outlet.lower().strip())
    if not outlet_data:
        return None
    return outlet_data.get(sku.strip())


def format_verified_table() -> str:
    lines = ["Verified stock table (system of record):"]
    for outlet, skus in VERIFIED_STOCK.items():
        for sku, qty in skus.items():
            lines.append(f"- Outlet: {outlet} | SKU: {sku} | Quantity: {qty}")
    return "\n".join(lines)
