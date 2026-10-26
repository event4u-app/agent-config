# Regression options

The regression panel fits a linear model to the selected metric. Three
options change how the model treats unusual data.

## Robust standard errors

Turn on **Robust standard errors** when the spread of your residuals grows
with the predicted value (heteroskedasticity). The coefficients do not
change; only the confidence intervals widen to stay valid. "Robust" here is
the statistical term: the estimator stays consistent when the
constant-variance assumption fails.

## High-leverage points

A point has high **leverage** when its predictor value sits far from the
others, so it can pull the fitted line toward itself. The diagnostics table
lists every point whose leverage exceeds 2p/n, where p is the number of
parameters and n the number of rows.

Removing a high-leverage point is a judgment call. Check the source row
first: an outlier caused by a unit mix-up should be fixed, not dropped.

## Robust regression

**Robust regression** (Huber loss) down-weights large residuals instead of
squaring them. Use it when a handful of rows are known to be noisy and you
cannot clean them at the source.

| Option | Changes coefficients | Changes intervals |
|---|---|---|
| Robust standard errors | No | Yes |
| Robust regression | Yes | Yes |
| Exclude high-leverage points | Yes | Yes |
