export const DEFAULT_MONTHLY_FEE = 197;
export const DEFAULT_SPLIT_FIXED_FEE = 2.9;
export const DEFAULT_SPLIT_PERCENTAGE = 7.9;
export const DEFAULT_PATIENT_SUBSCRIPTION = 39.9;

export function calculateMedycoPatientShare(
  amount: number,
  fixedFee = DEFAULT_SPLIT_FIXED_FEE,
  percentage = DEFAULT_SPLIT_PERCENTAGE,
) {
  return roundMoney(fixedFee + (amount * percentage) / 100);
}

export function calculateClinicNetRecurring({
  patients,
  patientSubscription = DEFAULT_PATIENT_SUBSCRIPTION,
  monthlyFee = DEFAULT_MONTHLY_FEE,
  fixedFee = DEFAULT_SPLIT_FIXED_FEE,
  percentage = DEFAULT_SPLIT_PERCENTAGE,
}: {
  patients: number;
  patientSubscription?: number;
  monthlyFee?: number;
  fixedFee?: number;
  percentage?: number;
}) {
  const grossRecurring = roundMoney(patients * patientSubscription);
  const medycoPatientShare = roundMoney(
    patients * calculateMedycoPatientShare(patientSubscription, fixedFee, percentage),
  );
  const platformCost = roundMoney(monthlyFee + medycoPatientShare);
  const clinicEstimatedBalance = roundMoney(grossRecurring - platformCost);

  return {
    grossRecurring,
    medycoPatientShare,
    platformCost,
    clinicEstimatedBalance,
  };
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
