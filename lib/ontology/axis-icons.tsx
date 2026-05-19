import {
  Boxes,
  CircleDollarSign,
  Factory,
  Hourglass,
  Layers,
  Network,
  Repeat,
  TrendingUp,
  Users,
  type LucideIcon
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  codp: Layers,
  demand_uncertainty: TrendingUp,
  volume_variety: Boxes,
  value_chain_position: Network,
  cash_conversion: CircleDollarSign,
  customer_concentration: Users,
  transaction_regime: Repeat,
  asset_specificity: Factory,
  perishability: Hourglass
};

export function axisIcon(axisId: string): LucideIcon {
  return ICONS[axisId] ?? Layers;
}
