'use client';

interface ProductData {
  product_id: string;
  product_name: string;
  potential_customers: number;
  potential_mrr: number;
}

interface ProductAdoptionChartProps {
  data: ProductData[];
}

export function ProductAdoptionChart({ data }: ProductAdoptionChartProps) {
  const maxCustomers = Math.max(...data.map(d => d.potential_customers), 1);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        No product data available
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="space-y-4">
        {data.map((product) => {
          const percentage = maxCustomers > 0
            ? (product.potential_customers / maxCustomers) * 100
            : 0;

          return (
            <div key={product.product_id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {product.product_name}
                </span>
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-900">
                    {product.potential_customers}
                  </span>
                  {' potential customers'}
                  <span className="text-green-600 ml-2">
                    (${product.potential_mrr.toLocaleString()}/mo)
                  </span>
                </div>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
